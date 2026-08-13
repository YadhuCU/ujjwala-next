export interface DashboardData {
  /** Role name as stored in the DB, e.g. "OWNER" / "OFFICE_STAFF". */
  role: string;
  kpis: {
    totalRevenue: number;
    totalProfit: number;
    totalExpenses: number;
    totalCollections: number;
    totalQtySold: number;
    customerCount: number;
    todayRevenue: number;
    oldComSaleCount: number;   // legacy Sale model (rent)
    domSaleCount: number;
    arbSaleCount: number;
    newComSaleCount: number;   // new CommercialSale model
  };
  dailyTrend: {
    date: string;
    revenue: number;
    cost: number;
    expense: number;
    profit: number;
    collections: number;
    oldComSales: number;   // legacy Sale model count
    domSales: number;
    arbSales: number;
    newComSales: number;   // new CommercialSale model count
  }[];
  productBreakdown: {
    name: string;
    revenue: number;
    qty: number;
    fill: string;
  }[];
  lowStock: {
    id: number;
    batchNo: string;
    productName: string;
    quantity: number;
  }[];
  recentTxns: {
    id: number;
    trNo: string | null;
    customer: string;
    product: string;
    amount: number;
    date: string;
    type: string;
  }[];
  commercialAnalytics: {
    pendingCylindersLong: {
      id: number;
      name: string;
      phone: string;
      rentQty: number;
      daysSinceLastReturn: number;
    }[];
    pendingPaymentLong: {
      id: number;
      name: string;
      phone: string;
      pendingAmount: number;
      daysSinceLastPayment: number;
    }[];
    highBalanceCustomers: {
      id: number;
      name: string;
      phone: string;
      pendingAmount: number;
      daysSinceLastPayment: number;
    }[];
  };
}
