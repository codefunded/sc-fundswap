/**
 * Filter out duplicate error/event names
 */
export const createDiamondDeduper = () => {
  const uniqueKeys = new Set<string>();
  return (abiElement: any, _index: number, _abi: any, _fullyQualifiedName: string) => {
    if (uniqueKeys.has(abiElement.name)) {
      return false;
    }
    uniqueKeys.add(abiElement.name);
    return true;
  };
};
