using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;

namespace Trumpfish.Server.Services.Dds;

/// <summary>
/// The slice of the DDS C ABI this application uses, and nothing else. DDS is a native C++ library (Apache-2.0,
/// https://github.com/dds-bridge/dds); the shared library is built from that repository with
/// <c>bazelisk build //jni:dds_shared</c> and shipped next to the application - see <c>native/README.md</c>.
///
/// Two of the library's three interfaces are touched here. Solving goes through the modern <c>dds_c_*</c> shim, where the
/// transposition table belongs to a context rather than to the process, so its memory can be bounded and two requests can
/// be solved side by side. Par goes through the flat legacy call, which the shim has no equivalent of and which needs no
/// context: it is a pure function of a finished table.
/// </summary>
internal static class DdsNative {

    /// <summary>
    /// One name for every platform: the runtime supplies the <c>lib</c> prefix and the extension, so this resolves
    /// <c>dds.dll</c> on Windows and <c>libdds.so</c> on Linux.
    /// </summary>
    private const string Library = "dds";

    /// <summary>DDS reports success as one rather than zero. Everything negative is an error code <see cref="DescribeError"/> can name.</summary>
    internal const int NoFault = 1;

    /// <summary>Length of the buffer DDS writes an error into. The header calls for eighty characters.</summary>
    private const int ErrorMessageLength = 80;


    /// <summary>Creates a solver with its own transposition table. <paramref name="ttKind"/> is 0 for the small table and 1 for the large one.</summary>
    [DllImport(Library, EntryPoint = "dds_c_create_solvercontext", CallingConvention = CallingConvention.Cdecl)]
    internal static extern DdsSolverHandle CreateSolver(int ttKind, int defaultMemoryMb, int maximumMemoryMb);


    [DllImport(Library, EntryPoint = "dds_c_destroy_solvercontext", CallingConvention = CallingConvention.Cdecl)]
    internal static extern void DestroySolver(IntPtr solver);


    /// <summary>Solves all twenty declarer and denomination combinations of one deal.</summary>
    [DllImport(Library, EntryPoint = "dds_c_calc_dd_table", CallingConvention = CallingConvention.Cdecl)]
    internal static extern int CalcDdTable(DdsSolverHandle solver, in DdsTableDeal deal, out DdsTableResults results);


    /// <summary>
    /// Par for a finished table. The binary form is the one to use: the other two write the contracts out as text, which
    /// would then have to be parsed back. <paramref name="dealer"/> is a seat, <paramref name="vulnerable"/> is 0 none,
    /// 1 both, 2 north-south, 3 east-west.
    /// </summary>
    [DllImport(Library, EntryPoint = "DealerParBin", CallingConvention = CallingConvention.Cdecl)]
    internal static extern int DealerParBin(in DdsTableResults table, out DdsParResults par, int dealer, int vulnerable);


    [DllImport(Library, EntryPoint = "GetDDSInfo", CallingConvention = CallingConvention.Cdecl)]
    internal static extern void GetDdsInfo(out DdsInfo info);


    [DllImport(Library, EntryPoint = "ErrorMessage", CallingConvention = CallingConvention.Cdecl, CharSet = CharSet.Ansi)]
    private static extern void ErrorMessage(int code, StringBuilder line);


    /// <summary>Turns a DDS return code into the text the library has for it.</summary>
    internal static string DescribeError(int code) {
        var line = new StringBuilder(ErrorMessageLength);
        ErrorMessage(code, line);
        return line.ToString();
    }
}


/// <summary>
/// Owns a native solver. A context is not safe to use from two threads at once, so one is rented per request rather than
/// shared; the handle makes sure the native allocation goes back even if the request is torn down.
/// </summary>
internal sealed class DdsSolverHandle : SafeHandle {

    /// <summary>Called by the marshaller, which is the only thing that ever constructs one of these.</summary>
    private DdsSolverHandle() : base(IntPtr.Zero, ownsHandle: true) { }

    public override bool IsInvalid => handle == IntPtr.Zero;

    protected override bool ReleaseHandle() {
        DdsNative.DestroySolver(handle);
        return true;
    }
}


/// <summary>Card holdings as DDS wants them: <c>unsigned int cards[4][4]</c>, hand major, in the DDS suit order.</summary>
[StructLayout(LayoutKind.Sequential)]
internal struct DdsTableDeal {

    public DdsHoldings Cards;

    /// <summary>The holding of one hand in one suit, both indexed the DDS way.</summary>
    internal uint this[int hand, int suit] {
        get => Cards[hand * DdsLayout.Suits + suit];
        set => Cards[hand * DdsLayout.Suits + suit] = value;
    }
}


/// <summary>Tricks as DDS returns them: <c>int resTable[5][4]</c>, denomination major.</summary>
[StructLayout(LayoutKind.Sequential)]
internal struct DdsTableResults {

    public DdsTricks Tricks;

    /// <summary>Tricks for one denomination and one hand, both indexed the DDS way.</summary>
    internal int this[int denomination, int hand] => Tricks[denomination * DdsLayout.Hands + hand];
}


/// <summary>One par contract. Mirrors the library's <c>contractType</c>, whose two numberings are its own - see <see cref="DdsLayout"/>.</summary>
[StructLayout(LayoutKind.Sequential)]
internal struct DdsContract {

    public int UnderTricks;

    public int OverTricks;

    public int Level;

    /// <summary>0 no trump, 1 spades, 2 hearts, 3 diamonds, 4 clubs. Not the numbering the trick table uses.</summary>
    public int Denomination;

    /// <summary>0 north, 1 east, 2 south, 3 west, 4 either of north-south, 5 either of east-west.</summary>
    public int Seats;
}


/// <summary>The library's <c>parResultsMaster</c>: a score and the contracts that reach it.</summary>
[StructLayout(LayoutKind.Sequential)]
internal struct DdsParResults {

    /// <summary>Signed from north-south's point of view.</summary>
    public int Score;

    /// <summary>How many entries of <see cref="Contracts"/> are filled in.</summary>
    public int Number;

    public DdsContracts Contracts;
}


/// <summary>What the loaded library says about itself. Mirrors the library's <c>DDSInfo</c>.</summary>
[StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
internal struct DdsInfo {

    public int Major;

    public int Minor;

    public int Patch;

    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 10)]
    public string VersionString;

    /// <summary>0 unknown, 1 Windows, 2 Cygwin, 3 Linux, 4 macOS.</summary>
    public int System;

    public int NumberOfBits;

    /// <summary>0 unknown, 1 MSVC, 2 mingw, 3 GCC, 4 clang.</summary>
    public int Compiler;

    public int Constructor;

    public int NumberOfCores;

    public int Threading;

    public int NumberOfThreads;

    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
    public string ThreadSizes;

    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 1024)]
    public string SystemString;
}


[InlineArray(DdsLayout.Hands * DdsLayout.Suits)]
internal struct DdsHoldings {
    private uint _element;
}


[InlineArray(DdsLayout.Denominations * DdsLayout.Hands)]
internal struct DdsTricks {
    private int _element;
}


[InlineArray(DdsLayout.ParContracts)]
internal struct DdsContracts {
    private DdsContract _element;
}


/// <summary>The shapes and numberings the C ABI is laid out with, kept in one place because two of them are traps.</summary>
internal static class DdsLayout {

    internal const int Hands = 4;

    internal const int Suits = 4;

    internal const int Denominations = 5;

    /// <summary>How many equally good par contracts the library will report.</summary>
    internal const int ParContracts = 10;

    /// <summary>Deuce is bit two, so a holding's bit number is the rank it stands for and the ace lands on bit fourteen.</summary>
    internal const int DeuceBit = 2;
}
