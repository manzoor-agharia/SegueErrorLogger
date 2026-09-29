<script setup lang="ts">
import { computed, ref } from 'vue';

import { useClickOutside } from '@/composables/useClickOutside';

export interface MultiSelectOption {
  value: string;
  label: string;
}

const props = withDefaults(
  defineProps<{
    options: MultiSelectOption[];
    selected: string[];
    allLabel?: string;
  }>(),
  { allLabel: 'All' },
);

const emit = defineEmits<{ 'update:selected': [string[]] }>();

const root = ref<HTMLElement | null>(null);
const open = ref(false);

useClickOutside(root, () => {
  open.value = false;
});

const summary = computed(() => {
  if (props.selected.length === 0) return props.allLabel;
  if (props.selected.length === 1) {
    return props.options.find((o) => o.value === props.selected[0])?.label ?? props.selected[0];
  }
  return `${props.selected.length} selected`;
});

function isChecked(value: string): boolean {
  return props.selected.includes(value);
}

function toggleOption(value: string, event: Event): void {
  const checked = (event.target as HTMLInputElement).checked;
  emit('update:selected', checked ? [...props.selected, value] : props.selected.filter((v) => v !== value));
}
</script>

<template>
  <div ref="root" class="c-multi-select">
    <button type="button" class="ms-trigger" @click="open = !open">
      <span class="ms-summary" :class="{ 'ms-summary--placeholder': selected.length === 0 }">{{ summary }}</span>
      <i class="material-icons">arrow_drop_down</i>
    </button>

    <div v-if="open" class="ms-panel">
      <div class="ms-panel-header">
        <span>{{ selected.length }} selected</span>
        <button v-if="selected.length > 0" type="button" class="ms-clear" @click="emit('update:selected', [])">
          Clear
        </button>
      </div>
      <ul class="ms-options">
        <li v-for="option in options" :key="option.value">
          <label class="ms-option">
            <input type="checkbox" :checked="isChecked(option.value)" @change="toggleOption(option.value, $event)" />
            <span>{{ option.label }}</span>
          </label>
        </li>
      </ul>
    </div>
  </div>
</template>
