namespace Trumpfish.Server.Data;

/// <summary>
/// One deal a user kept: the cards, the auction they produced and what the user wants to remember about it.
/// </summary>
/// <remarks>
/// The deal itself is stored as the JSON the client already draws a card from, rather than as tables of hands and bids. A
/// saved deal is a snapshot to look at, not something the engine will ever query across - and the shape it is drawn in is
/// the one thing about it that must not change under it when the model does.
///
/// No analysis travels with it. The double dummy tables are worked out on demand and cost real time, so a saved deal
/// carries what was dealt and what was said, and the analysis is asked for again if it is wanted.
/// </remarks>
public class SavedDealRecord {

    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The account it belongs to. Deleting the account takes its deals, and with them every share of them.</summary>
    public Guid OwnerId { get; set; }

    public UserRecord? Owner { get; set; }

    /// <summary>What the user called it. This is what the list is read by, so it is required.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// The user's own keywords, space separated. Deliberately a column rather than a table: tags here are words somebody
    /// typed for himself, not entities shared between accounts, and a table of them would only make them look like one.
    /// </summary>
    public string Tags { get; set; } = string.Empty;

    /// <summary>Whatever the user wanted to say about the deal. Optional.</summary>
    public string? Comment { get; set; }

    /// <summary>The contract the auction ended in, as it is written - "3NT E", "4♠ S", "Pas". Kept out of the payload so it is there to read.</summary>
    public string Contract { get; set; } = string.Empty;

    /// <summary>The level it was played at, and in what. Null for a passed board. Columns rather than text, because
    /// "every contract in hearts" is a question about the denomination and not about how the contract happens to be spelt.</summary>
    public int? Level { get; set; }

    public Model.Enums.BidColor? Color { get; set; }

    /// <summary>The seat that played it. Null for a passed board.</summary>
    public Model.Enums.PlayerPosition? Declarer { get; set; }

    public Model.Enums.PlayerPosition Dealer { get; set; }

    public Model.Enums.Vulnerability Vulnerability { get; set; }

    public DateTimeOffset SavedUtc { get; set; } = DateTimeOffset.UtcNow;

    /// <summary>The deal as `SimulationDealResult` JSON: four hands, the auction and the contract.</summary>
    public string Deal { get; set; } = string.Empty;

    /// <summary>Who this deal has been handed to. Deleting the deal deletes them, which is what takes it off their lists.</summary>
    public ICollection<SavedDealShareRecord> Shares { get; set; } = [];
}
