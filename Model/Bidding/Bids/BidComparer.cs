using System;
using System.Collections.Generic;
using System.Diagnostics.CodeAnalysis;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model.Bidding.Bids {

    public class BidComparer : IEqualityComparer<Bid> {

        public bool Equals(Bid? x, Bid? y) {
            return x?.Equals(y) ?? true;
        }


        public int GetHashCode([DisallowNull] Bid obj) {
            return obj.GetBidCode();
        }

    }

}