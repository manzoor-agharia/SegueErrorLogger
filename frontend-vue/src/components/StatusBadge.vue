<script setup lang="ts">
import { computed } from 'vue';

import { STATUS_LABELS, type ErrorStatus } from '@/types/errorLog';

const props = defineProps<{ status: ErrorStatus }>();

const label = computed(() => STATUS_LABELS[props.status]);
</script>

<template>
  <span class="badge" :class="`badge-${status}`">{{ label }}</span>
</template>
