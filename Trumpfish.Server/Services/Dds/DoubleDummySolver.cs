using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;
using Model;
using Model.DoubleDummy;
using Model.Enums;
using System.Collections.Concurrent;
using Trumpfish.Server.Configuration;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services.Dds;

/// <summary>
/// Drives the native solver. A singleton for two reasons: the native solvers it pools are expensive to create, and the
/// number of them in existence is what bounds how much memory the feature can take.
///
/// Nothing here is eager. The library is not loaded until the first deal is asked about, and a machine without it built
/// runs the rest of the application exactly as before - the service simply reports itself unavailable.
/// </summary>
public sealed class DoubleDummySolver : IDoubleDummySolver, IDisposable {

    private readonly DoubleDummyOptions _options;
    private readonly ILogger<DoubleDummySolver> _logger;

    /// <summary>Bounds how many deals are in the solver at once, and with that how many solvers exist at all.</summary>
    private readonly SemaphoreSlim _slots;

    /// <summary>Solvers not currently in a request. Never larger than the number of slots.</summary>
    private readonly ConcurrentBag<DdsSolverHandle> _idle = new();

    /// <summary>
    /// Solved tables, keyed by the cards themselves. Its own cache rather than the application's, so a size limit can be
    /// put on it without that limit meaning anything to anybody else.
    /// </summary>
    private readonly MemoryCache _tables;

    /// <summary>
    /// Par is a pure function of a finished table and takes microseconds, but it is a call into the library's flat C
    /// interface, which makes no promises about being called from two threads at once. Cheaper to serialise than to check.
    /// </summary>
    private readonly object _parLock = new();

    /// <summary>Null once the library has answered for itself, otherwise why it cannot be used. Evaluated once, on the first question asked.</summary>
    private readonly Lazy<string?> _probe;

    private bool _disposed;


    public DoubleDummySolver(IOptions<DoubleDummyOptions> options, ILogger<DoubleDummySolver> logger) {
        _options = options.Value;
        _logger = logger;
        _slots = new SemaphoreSlim(_options.ResolveConcurrency(), _options.ResolveConcurrency());
        _tables = new MemoryCache(new MemoryCacheOptions { SizeLimit = _options.CacheSize });
        _probe = new Lazy<string?>(Probe, LazyThreadSafetyMode.ExecutionAndPublication);
    }


    public bool IsAvailable => _probe.Value is null;

    public string? UnavailableReason => _probe.Value;


    public DoubleDummyInfo Describe() {
        var reason = _probe.Value;
        if (reason is not null) {
            return new DoubleDummyInfo(false, reason, null, null, null, null);
        }

        DdsNative.GetDdsInfo(out var info);
        return new DoubleDummyInfo(true, null, info.VersionString, DescribePlatform(info.System), info.NumberOfCores, info.SystemString);
    }


    public async Task<DoubleDummyAnalysis> AnalyseAsync(
        IReadOnlyDictionary<PlayerPosition, Hand> hands,
        PlayerPosition dealer,
        Vulnerability vulnerability,
        CancellationToken cancellationToken) {

        ObjectDisposedException.ThrowIf(_disposed, this);

        var reason = _probe.Value;
        if (reason is not null) {
            throw new InvalidOperationException(reason);
        }

        var deal = DdsMapping.ToTableDeal(hands);
        var key = DdsMapping.Fingerprint(deal);

        // The table depends on the fifty-two cards and on nothing else, so the same deal at another vulnerability, or the
        // same deal looked at twice, only ever costs the par calculation.
        if (!_tables.TryGetValue(key, out DdsTableResults results)) {
            results = await SolveAsync(deal, cancellationToken);

            _tables.Set(key, results, new MemoryCacheEntryOptions {
                Size = 1,
                SlidingExpiration = TimeSpan.FromMinutes(_options.CacheMinutes)
            });
        }

        return BuildAnalysis(results, dealer, vulnerability);
    }


    public void Dispose() {
        if (_disposed) {
            return;
        }

        _disposed = true;

        while (_idle.TryTake(out var solver)) {
            solver.Dispose();
        }

        _tables.Dispose();
        _slots.Dispose();
    }


    private async Task<DdsTableResults> SolveAsync(DdsTableDeal deal, CancellationToken cancellationToken) {
        await _slots.WaitAsync(cancellationToken);

        try {
            // The last point at which giving up is still free: past here the request is a single call into C++ that runs
            // to completion whatever happens to the caller.
            cancellationToken.ThrowIfCancellationRequested();

            return await Task.Run(() => Solve(deal), cancellationToken);
        }
        finally {
            _slots.Release();
        }
    }


    private DdsTableResults Solve(DdsTableDeal deal) {
        var solver = Rent();

        try {
            var code = DdsNative.CalcDdTable(solver, in deal, out var results);
            if (code != DdsNative.NoFault) {
                throw new DdsException(code);
            }

            return results;
        }
        finally {
            _idle.Add(solver);
        }
    }


    private DoubleDummyAnalysis BuildAnalysis(DdsTableResults results, PlayerPosition dealer, Vulnerability vulnerability) {
        int code;
        DdsParResults par;

        lock (_parLock) {
            code = DdsNative.DealerParBin(in results, out par, (int)dealer, DdsMapping.ToDdsVulnerability(vulnerability));
        }

        if (code != DdsNative.NoFault) {
            throw new DdsException(code);
        }

        return new DoubleDummyAnalysis(dealer, vulnerability, DdsMapping.ToTable(results), par.Score, DdsMapping.ToParContracts(par));
    }


    private DdsSolverHandle Rent() {
        if (_idle.TryTake(out var pooled)) {
            return pooled;
        }

        var solver = DdsNative.CreateSolver(
            _options.LargeTranspositionTable ? 1 : 0,
            _options.TranspositionTableMb,
            _options.MaximumTranspositionTableMb);

        if (solver.IsInvalid) {
            solver.Dispose();
            throw new InvalidOperationException("Nie udało się utworzyć solvera DDS - biblioteka odmówiła przydziału pamięci.");
        }

        return solver;
    }


    /// <summary>
    /// Loads the library and makes it prove it is the right one. Everything that can go wrong with a native dependency
    /// goes wrong here rather than in the middle of a request, and says so in terms the caller can pass on.
    ///
    /// The proof is creating a solver rather than asking the library its version: that is the entry point the analysis
    /// actually depends on, and the one a 2.x library - which has the same name and most of the same functions - does not
    /// have. The solver it creates goes into the pool, so the first deal does not pay for it twice.
    /// </summary>
    private string? Probe() {
        if (!_options.Enabled) {
            return "Analiza DDS jest wyłączona w konfiguracji serwera.";
        }

        try {
            var solver = DdsNative.CreateSolver(
                _options.LargeTranspositionTable ? 1 : 0,
                _options.TranspositionTableMb,
                _options.MaximumTranspositionTableMb);

            if (solver.IsInvalid) {
                solver.Dispose();
                return "Solver DDS nie zdołał przydzielić pamięci - zmniejsz DoubleDummy:TranspositionTableMb.";
            }

            _idle.Add(solver);

            DdsNative.GetDdsInfo(out var info);

            _logger.LogInformation(
                "DDS {Version} załadowany ({Platform}, {Bits}-bit, {Cores} rdzeni). Równoległość: {Concurrency}, tablica transpozycji: {DefaultMb}-{MaximumMb} MB.",
                info.VersionString,
                DescribePlatform(info.System),
                info.NumberOfBits,
                info.NumberOfCores,
                _options.ResolveConcurrency(),
                _options.TranspositionTableMb,
                _options.MaximumTranspositionTableMb);

            return null;
        }
        catch (Exception exception) when (exception is DllNotFoundException or EntryPointNotFoundException or BadImageFormatException) {
            _logger.LogWarning(exception, "Biblioteka DDS nie została załadowana - analiza rozdań będzie niedostępna.");

            return exception switch {
                DllNotFoundException => "Biblioteka DDS nie została znaleziona na tym serwerze.",
                EntryPointNotFoundException => "Załadowana biblioteka DDS nie udostępnia wymaganych funkcji - prawdopodobnie jest to inna wersja niż 3.x.",
                _ => "Biblioteka DDS ma niezgodną architekturę - oczekiwana jest wersja 64-bitowa."
            };
        }
    }


    private static string DescribePlatform(int system) {
        return system switch {
            1 => "Windows",
            2 => "Cygwin",
            3 => "Linux",
            4 => "macOS",
            _ => "nieznana platforma"
        };
    }
}
