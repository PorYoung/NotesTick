<template>
	<div id="app">
		<div class="black-background"></div>
		<div class="smoke-background">
			<div class="smoke"></div>
			<div class="smoke"></div>
			<div class="smoke"></div>
			<div class="smoke"></div>
			<div class="smoke"></div>
			<div class="smoke"></div>
			<div class="smoke"></div>
			<div class="smoke"></div>
		</div>
		<div class="logo-background"></div>
		<router-view></router-view>
	</div>
</template>

<script>
export default {
	name: "NotesTick",
};
</script>

<style lang="scss">
@import "@/styles/_public.scss";
</style>
