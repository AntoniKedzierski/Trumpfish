using Model;
using Model.Bidding.AI;
using Model.Bidding.Bids;
using Model.Enums;
using Model.Helpers;
using Trumpfish.Server.Contracts;

namespace Trumpfish.Server.Services;

/// <summary>Why a command against a live table was refused.</summary>
public enum DuoResult {
    Success,

    /// <summary>There is no such session, or the caller does not sit at it.</summary>
    NotFound,

    /// <summary>Somebody else is on turn, or the auction is over, or the deal has not finished yet.</summary>
    WrongMoment,

    /// <summary>The bid is not legal at this point of the auction.</summary>
    IllegalBid,

    /// <summary>Only the host settles the session: the next deal is his to call.</summary>
    HostOnly,

    /// <summary>The host turned engine hints off for this session.</summary>
    NotAllowed,

    /// <summary>No hand satisfying the practised opening could be dealt.</summary>
    CannotDeal
}

/// <summary>One deal of a session: the four hands, and the human bids made against them so far.</summary>
internal sealed class DuoDeal {

    public required int Index { get; init; }

    public required PlayerPosition Dealer { get; init; }

    /// <summary>The seat that was dealt the practised opening. Drawn afresh every deal, which is what rotates the roles.</summary>
    public required PlayerPosition Opener { get; init; }

    public required Dictionary<PlayerPosition, Hand> Hands { get; init; }

    /// <summary>Every human bid in the order it was made. Both seats share the list: their turns come round in a fixed order.</summary>
    public List<PracticeStoredBid> Bids { get; } = [];
}


/// <summary>
/// Two people at one table against two bots, kept alive in the servers memory for exactly as long as they are both at it.
/// </summary>
/// <remarks>
/// The pair sits North-South - host to the South, guest to the North - so the two of them are partners and the bots are the
/// opposition, which is the arrangement a bidding system is actually practised in. The auction is replayed from the stored
/// bids on every read, exactly as the solo table does it, so there is no half-applied state to get wrong; the only thing that
/// is really kept is the deal itself and the list of human bids.
/// </remarks>
public sealed class DuoSession {

    /// <summary>Both seats, so the engine leaves them both to the people sitting in them.</summary>
    private static readonly PlayerPosition[] Seats = [PlayerPosition.North, PlayerPosition.South];

    private readonly Lock _gate = new();
    private readonly BiddingSystem _system;
    private readonly Guid[] _users;
    private readonly string[] _names;
    private readonly bool[] _connected;

    private DuoDeal _deal;


    internal DuoSession(Guid id, BiddingSystem system, string systemName, string? openingLabel, DuoSettings settings, Guid hostId, string hostName, Guid guestId, string guestName, DuoDeal deal) {
        Id = id;
        _system = system;
        SystemName = systemName;
        OpeningLabel = openingLabel;
        Settings = settings;
        HostId = hostId;
        GuestId = guestId;
        _deal = deal;

        // Indexed by seat, so everything below can work from a position without asking which of the two people it belongs to.
        _users = new Guid[4];
        _names = new string[4];
        _connected = new bool[4];

        _users[(int)PlayerPosition.South] = hostId;
        _users[(int)PlayerPosition.North] = guestId;
        _names[(int)PlayerPosition.South] = hostName;
        _names[(int)PlayerPosition.North] = guestName;
        _connected[(int)PlayerPosition.South] = true;
        _connected[(int)PlayerPosition.North] = true;
    }


    public Guid Id { get; }

    public Guid HostId { get; }

    public Guid GuestId { get; }

    public DuoSettings Settings { get; }

    public string SystemName { get; }

    public string? OpeningLabel { get; }

    /// <summary>Both people at the table, which is who every change of it has to be sent to.</summary>
    public IReadOnlyList<Guid> Members => [HostId, GuestId];


    public Guid Other(Guid userId) {
        return userId == HostId ? GuestId : HostId;
    }


    /// <summary>Notes that one of the two has come back or dropped out. Returns false when the account does not sit here at all.</summary>
    public bool SetConnected(Guid userId, bool connected) {
        var seat = SeatOf(userId);
        if (seat == null) {
            return false;
        }

        lock (_gate) {
            _connected[(int)seat] = connected;
        }

        return true;
    }


    public bool IsConnected(Guid userId) {
        var seat = SeatOf(userId);

        lock (_gate) {
            return seat != null && _connected[(int)seat];
        }
    }


    public PlayerPosition? SeatOf(Guid userId) {
        if (userId == HostId) {
            return PlayerPosition.South;
        }

        return userId == GuestId ? PlayerPosition.North : null;
    }


    /// <summary>Plays one bid for the seat the account sits in, and lets the bots answer up to the next human turn.</summary>
    public DuoResult Bid(Guid userId, PracticeStoredBid bid) {
        var seat = SeatOf(userId);
        if (seat == null) {
            return DuoResult.NotFound;
        }

        lock (_gate) {
            var replay = Replay();

            if (replay.Finished || replay.Waiting != seat) {
                return DuoResult.WrongMoment;
            }

            if (!PracticeRules.IsLegal(replay.Auction, TableEngine.ToBid(bid))) {
                return DuoResult.IllegalBid;
            }

            _deal.Bids.Add(bid);
            return DuoResult.Success;
        }
    }


    /// <summary>What the engine would bid holding the cards of whoever asked. Refused when the host turned hints off.</summary>
    public (DuoResult Result, PracticeHint? Hint) Hint(Guid userId) {
        if (!Settings.AllowHints) {
            return (DuoResult.NotAllowed, null);
        }

        var seat = SeatOf(userId);
        if (seat == null) {
            return (DuoResult.NotFound, null);
        }

        lock (_gate) {
            var replay = Replay();
            if (replay.Waiting != seat) {
                return (DuoResult.WrongMoment, null);
            }

            var advice = replay.Advice;
            return (DuoResult.Success, advice == null ? new PracticeHint(null, null) : new PracticeHint(TableEngine.Label(advice), advice.Explanation));
        }
    }


    /// <summary>Deals the next hand of the session. The host calls it, and it only answers once the current auction is over.</summary>
    public DuoResult NextDeal(Guid userId) {
        if (userId != HostId) {
            return DuoResult.HostOnly;
        }

        lock (_gate) {
            if (!Replay().Finished) {
                return DuoResult.WrongMoment;
            }

            var next = Deal(_system, Settings, _deal.Index + 1);
            if (next == null) {
                return DuoResult.CannotDeal;
            }

            _deal = next;
            return DuoResult.Success;
        }
    }


    /// <summary>
    /// The table as one of the two may see it. Built per person: each gets his own hand, his own warnings and his own turn
    /// flag, and the other three hands only ever arrive inside the result of an auction that is already over.
    /// </summary>
    public DuoTableState? StateFor(Guid userId) {
        var seat = SeatOf(userId);
        if (seat == null) {
            return null;
        }

        lock (_gate) {
            var replay = Replay();
            var position = seat.Value;
            var partner = position == PlayerPosition.South ? PlayerPosition.North : PlayerPosition.South;

            return new DuoTableState(
                Id,
                _deal.Index + 1,
                _deal.Dealer,
                BoardHelper.VulnerabilityOf(_deal.Index),
                AuctionMapping.MapHand(position, _deal.Hands[position]),
                replay.Bidding,
                replay.WarningsFor(position),
                replay.Waiting == position,
                replay.Legal,
                replay.Finished,
                replay.Finished ? TableEngine.Result(replay, _deal.Index, _deal.Dealer) : null,
                replay.Error,
                Settings,
                Describe(position),
                Describe(partner),
                SystemName,
                OpeningLabel);
        }
    }


    private DuoSeat Describe(PlayerPosition seat) {
        return new DuoSeat(_users[(int)seat], _names[(int)seat], seat, _connected[(int)seat], _users[(int)seat] == HostId);
    }


    private TableReplay Replay() {
        return TableEngine.Replay(_system, _deal.Hands, _deal.Dealer, Seats, _deal.Bids, Settings.CheckBids, _deal.Index);
    }


    /// <summary>
    /// Builds deal number <paramref name="index"/> of a session, or null when no hand can satisfy the practised opening.
    /// </summary>
    /// <remarks>
    /// Which of the two partners gets the opening hand is drawn from the same generator as the cards, so a named seed still
    /// reproduces the whole session - including who was the opener in each deal of it.
    /// </remarks>
    internal static DuoDeal? Deal(BiddingSystem system, DuoSettings settings, int index) {
        var opening = TableEngine.FindOpening(system, settings.OpeningNodeId);
        var random = TableEngine.RandomFor(settings.Seed, index);
        var opener = Seats[random.Next(Seats.Length)];
        var hands = PracticeDealer.Deal(random, opening, opener);

        if (hands == null) {
            return null;
        }

        // Every deal is started by the next player round the table, so the pair bids from different positions each time.
        return new DuoDeal { Index = index, Dealer = (PlayerPosition)(((index % 4) + 4) % 4), Opener = opener, Hands = hands };
    }


    /// <summary>How an opening reads in the invitation and on the table, so the guest sees what he agreed to practise.</summary>
    internal static string? DescribeOpening(BidNode? node) {
        if (node == null) {
            return null;
        }

        var meaning = new[] { node.Condition, node.Convention == null ? null : $"⟨{node.Convention}⟩", node.Description }
            .FirstOrDefault(part => !string.IsNullOrWhiteSpace(part));

        return $"{AuctionMapping.Describe(node)} · {meaning?.Trim() ?? "bez opisu"}";
    }
}
