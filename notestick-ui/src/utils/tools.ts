const _len = (o: any) => {
  return o instanceof Array
    ? o.length
    : o instanceof Set
    ? o.size
    : Object.keys(o).length;
};

export { _len };
