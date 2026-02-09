export interface Transaction {
  _id: string;
  userId: string;
  type: 'Deposit' | 'Withdrawal' | 'Win' | 'Loss';
  amount: number;
  status: 'Completed' | 'Pending' | 'Failed';
  date: string;
  details?: {
    matchId?: string;
    withdrawalRequestId?: string;
    paymentId?: string;
  };
  createdAt: string;
  updatedAt: string;
}
