using Model.Bidding.Bids;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Model; 

public interface IBidInput {

    public Bid Get(Hand hand, int? dealNumber = null);

    public void Reset();
}
