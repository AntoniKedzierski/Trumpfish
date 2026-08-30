using Model.Bidding;
using Model.Bidding.AI;
using Model.Bidding.Bids;

namespace Trumpfish.Server.Data;

/// <summary>
/// Translates between the domain tree from the <c>Model</c> project and the flat rows stored in the database.
/// Keeping the translation here is what lets the domain model stay persistence ignorant while the schema stays normalised.
/// </summary>
public static class BiddingSystemMapper {

    /// <summary>
    /// Rebuilds the domain tree from a record whose <see cref="BiddingSystemRecord.Roots"/> and their bids are already loaded.
    /// Every node of a root carries that root's id, so the loaded collections are flat and the nesting is restored from <see cref="BidNodeRecord.ParentId"/>.
    /// </summary>
    public static BiddingSystem ToDomain(BiddingSystemRecord record) {
        var system = new BiddingSystem { SystemName = record.Name };

        foreach (var rootRecord in record.Roots.OrderBy(root => root.SortOrder)) {
            var childrenByParent = rootRecord.Bids.Where(bid => bid.ParentId != null).GroupBy(bid => bid.ParentId!.Value).ToDictionary(group => group.Key, group => group.ToList());
            var root = new Root {
                Name = rootRecord.Name,
                Bids = BuildNodes(rootRecord.Bids.Where(bid => bid.ParentId == null), childrenByParent)
            };

            system.Roots.Add(root);
        }

        system.AssignParent();
        return system;
    }


    /// <summary>
    /// Projects the domain tree onto fresh rows for <paramref name="record"/>. The caller is responsible for removing the
    /// previous roots and nodes: a save replaces the whole tree rather than diffing it, which is both simpler and what the
    /// browser's "save the entire system" gesture actually means.
    /// </summary>
    public static (List<BiddingRootRecord> Roots, List<BidNodeRecord> Nodes) ToRecords(BiddingSystem system, BiddingSystemRecord record) {
        var roots = new List<BiddingRootRecord>();
        var nodes = new List<BidNodeRecord>();

        // Copy and paste inside the browser can, in principle, hand us the same node identity twice within one system. Clients
        // address a bid by that identity, so a duplicate is re-keyed rather than left ambiguous.
        var usedNodeIds = new HashSet<Guid>();

        for (var rootIndex = 0; rootIndex < system.Roots.Count; ++rootIndex) {
            var root = system.Roots[rootIndex];
            var rootRecord = new BiddingRootRecord { BiddingSystemId = record.Id, Name = root.Name, SortOrder = rootIndex };
            roots.Add(rootRecord);

            FlattenNodes(root.Bids, rootRecord.Id, null, nodes, usedNodeIds);
        }

        return (roots, nodes);
    }


    private static List<BidNode> BuildNodes(IEnumerable<BidNodeRecord> records, Dictionary<Guid, List<BidNodeRecord>> childrenByParent) {
        var nodes = new List<BidNode>();

        foreach (var record in records.OrderBy(bid => bid.SortOrder)) {
            var node = new BidNode {
                NodeId = record.NodeId,
                Type = record.Type,
                Color = record.Color,
                Value = record.Value,
                IsFromSystem = record.IsFromSystem,
                Explanation = record.Explanation,
                Description = record.Description,
                Condition = record.Condition,
                Convention = record.Convention,
                PointsRange = ToRange(record.PointsLower, record.PointsUpper),
                SpadesCardRange = ToRange(record.SpadesLower, record.SpadesUpper),
                HeartsCardRange = ToRange(record.HeartsLower, record.HeartsUpper),
                DiamondsCardRange = ToRange(record.DiamondsLower, record.DiamondsUpper),
                ClubsCardRange = ToRange(record.ClubsLower, record.ClubsUpper),
                SpadesStops = record.SpadesStops,
                HeartsStops = record.HeartsStops,
                DiamondsStops = record.DiamondsStops,
                ClubsStops = record.ClubsStops,
                ColorDistribution = record.ColorDistribution,
                Aces = record.Aces,
                Kings = record.Kings,
                OpenerBid = record.OpenerBid,
                SignOff = record.SignOff,
                OneRoundForcing = record.OneRoundForcing,
                GameForcing = record.GameForcing,
                AutomaticResponse = record.AutomaticResponse,
                GoToOpenings = record.GoToOpenings,
                IsPreferred = record.IsPreferred,
                RealizedGoal = record.RealizedGoal,
                AiSource = record.AiSource,
                Interjection = ToInterjection(record)
            };

            if (childrenByParent.TryGetValue(record.Id, out var children)) {
                node.NextBids = BuildNodes(children, childrenByParent);
            }

            nodes.Add(node);
        }

        return nodes;
    }


    private static void FlattenNodes(List<BidNode> nodes, Guid rootId, Guid? parentId, List<BidNodeRecord> target, HashSet<Guid> usedNodeIds) {
        for (var index = 0; index < nodes.Count; ++index) {
            var node = nodes[index];
            var nodeId = node.NodeId == Guid.Empty || !usedNodeIds.Add(node.NodeId) ? NewUniqueId(usedNodeIds) : node.NodeId;
            var rowId = Guid.NewGuid();

            target.Add(new BidNodeRecord {
                Id = rowId,
                NodeId = nodeId,
                RootId = rootId,
                ParentId = parentId,
                SortOrder = index,
                Type = node.Type,
                Color = node.Color,
                Value = node.Value,
                IsFromSystem = node.IsFromSystem,
                Explanation = node.Explanation,
                Description = node.Description,
                Condition = node.Condition,
                Convention = node.Convention,
                PointsLower = node.PointsRange?.Lower,
                PointsUpper = node.PointsRange?.Upper,
                SpadesLower = node.SpadesCardRange?.Lower,
                SpadesUpper = node.SpadesCardRange?.Upper,
                HeartsLower = node.HeartsCardRange?.Lower,
                HeartsUpper = node.HeartsCardRange?.Upper,
                DiamondsLower = node.DiamondsCardRange?.Lower,
                DiamondsUpper = node.DiamondsCardRange?.Upper,
                ClubsLower = node.ClubsCardRange?.Lower,
                ClubsUpper = node.ClubsCardRange?.Upper,
                SpadesStops = node.SpadesStops,
                HeartsStops = node.HeartsStops,
                DiamondsStops = node.DiamondsStops,
                ClubsStops = node.ClubsStops,
                ColorDistribution = node.ColorDistribution,
                Aces = node.Aces,
                Kings = node.Kings,
                OpenerBid = node.OpenerBid,
                SignOff = node.SignOff,
                OneRoundForcing = node.OneRoundForcing,
                GameForcing = node.GameForcing,
                AutomaticResponse = node.AutomaticResponse,
                GoToOpenings = node.GoToOpenings,
                IsPreferred = node.IsPreferred,
                RealizedGoal = node.RealizedGoal,
                AiSource = node.AiSource,
                InterjectionType = node.Interjection?.Type,
                InterjectionColor = node.Interjection?.Color,
                InterjectionValue = node.Interjection?.Value,
                InterjectionIsFromSystem = node.Interjection?.IsFromSystem,
                InterjectionExplanation = node.Interjection?.Explanation
            });

            // Children hang off the row identity, which is what the parent foreign key actually references.
            FlattenNodes(node.NextBids, rootId, rowId, target, usedNodeIds);
        }
    }


    private static Guid NewUniqueId(HashSet<Guid> usedNodeIds) {
        Guid id;
        do {
            id = Guid.NewGuid();
        } while (!usedNodeIds.Add(id));

        return id;
    }


    /// <summary>A range with neither bound set carries no information, so it is stored - and returned - as no range at all.</summary>
    private static NumberRange? ToRange(int? lower, int? upper) => lower == null && upper == null ? null : new NumberRange(lower, upper);


    private static Bid? ToInterjection(BidNodeRecord record) {
        if (record.InterjectionType == null) {
            return null;
        }

        return new Bid {
            Type = record.InterjectionType.Value,
            Color = record.InterjectionColor ?? Model.Enums.BidColor.NoColor,
            Value = record.InterjectionValue,
            IsFromSystem = record.InterjectionIsFromSystem ?? false,
            Explanation = record.InterjectionExplanation
        };
    }
}
