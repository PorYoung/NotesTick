export default {
	data() {},
	methods: {
		/**
		 * 工具方法
		 * @param o [Object|Set|Array]
		 * @return 对象内容的长度
		 */
		_len(o) {
			return o instanceof Array
				? o.length
				: o instanceof Set
				? o.size
				: Object.keys(o).length;
		},
	},
};
