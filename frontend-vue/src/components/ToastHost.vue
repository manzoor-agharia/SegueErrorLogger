<script setup lang="ts">
import { useToastStore } from '@/stores/toast';

const toast = useToastStore();
</script>

<template>
  <div
    v-for="msg in toast.messages"
    :key="msg.id"
    class="toast"
    :class="`toast-${msg.variant}`"
    style="cursor: pointer"
    @click="toast.dismiss(msg.id)"
  >
    {{ msg.text }}
  </div>
</template>
