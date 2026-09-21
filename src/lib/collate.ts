// One shared collator for catalog sorts. `a.localeCompare(b)` orders strings the
// same way but sets up collation on every call, which costs milliseconds per
// 8k-record sort — enough on its own to exceed the Workers free-plan CPU limit.
export const compareText: (a: string, b: string) => number = new Intl.Collator().compare;
