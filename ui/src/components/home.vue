<template>
	<div>
		<h1>选择模式</h1>
		<h2>
			<router-link
				to="/solo-hint?room=cgb&midi=qingtian.mid&velocity=1&maxKeys=6"
				>Solo</router-link
			>
		</h2>
		<h2>
			<router-link to="/battle">Battle</router-link>
		</h2>
		<h2>
			<router-link to="/fullScreen">fullScreen</router-link>
		</h2>
	</div>
</template>

<script>
export default {
	name: "Home",
};
</script>
