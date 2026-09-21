using Model.Bidding.Bids;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.AI.Engine;

public record SystemBranchResponse(BidNode BidNode, bool SystemResponse, double Score);