export const cashPackages = [
  { amount: 50, bonus: 0, price: 499, originalPrice: 998, survivalOnly: true, artwork: "coins" },
  { amount: 100, bonus: 10, price: 999, originalPrice: 1998, survivalOnly: false, artwork: "coins" },
  { amount: 300, bonus: 50, price: 2999, originalPrice: 5998, survivalOnly: false, artwork: "chest" },
  { amount: 500, bonus: 100, price: 4999, originalPrice: 9998, survivalOnly: false, artwork: "chest" },
  { amount: 1000, bonus: 200, price: 9999, originalPrice: 19998, survivalOnly: false, artwork: "chest" },
] as const;

export type CashPackage = (typeof cashPackages)[number];
