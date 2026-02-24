export interface Transaction {
  _id: string;
  userId: string;
  type: 'Deposit' | 'Withdrawal' | 'Win' | 'Loss' | 'RtcPurchase' | 'RtcRefill' | 'RtcAnte' | 'RtcWin' | 'RtcEntry';
  amount: number;
  currency: 'USD' | 'RTC';
  status: 'Completed' | 'Pending' | 'Failed';
  date: string;
  details?: {
    matchId?: string;
    withdrawalRequestId?: string;
    paymentId?: string;
    bundleId?: string;
    contestId?: string;
  };
  createdAt: string;
  updatedAt: string;
}
