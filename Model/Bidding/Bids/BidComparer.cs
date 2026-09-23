using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.Bids {

    public class BidComparer : IEqualityComparer<InterruptedBid> {

        public bool Equals(InterruptedBid? x, InterruptedBid? y) {
            return x?.Equals(y) ?? true;
        }


        public int GetHashCode([DisallowNull] InterruptedBid obj) {
            return obj.GetBidCode();
        }

    }

}