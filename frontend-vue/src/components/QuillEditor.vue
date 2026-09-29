<script setup lang="ts">
import Quill from 'quill';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

/**
 * Thin v-model wrapper around Quill 2, standing in for `ngx-quill`'s <quill-editor>.
 * Wrapping Quill directly (rather than pulling in a framework-specific binding) keeps the
 * editor config identical to the Angular app's and avoids a peer-dependency chase.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  { placeholder: '' },
);

const emit = defineEmits<{ 'update:modelValue': [string] }>();

const TOOLBAR = [
  ['bold', 'italic', 'underline', 'strike'],
  [{ header: [2, 3, false] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block', 'link'],
  ['clean'],
];

const container = ref<HTMLElement | null>(null);
let quill: Quill | null = null;
/** Guards the watcher below so echoing our own emitted value back doesn't move the caret. */
let applyingExternalValue = false;

onMounted(() => {
  if (!container.value) return;

  quill = new Quill(container.value, {
    theme: 'snow',
    placeholder: props.placeholder,
    modules: { toolbar: TOOLBAR },
  });

  if (props.modelValue) {
    quill.clipboard.dangerouslyPasteHTML(props.modelValue);
  }

  quill.on('text-change', () => {
    if (applyingExternalValue || !quill) return;
    // Quill represents "empty" as "<p><br></p>"; normalise that to '' so required-field
    // checks behave the way they did with ngx-quill's `[format]="'html'"` binding.
    const html = quill.getSemanticHTML();
    emit('update:modelValue', quill.getText().trim().length === 0 ? '' : html);
  });
});

watch(
  () => props.modelValue,
  (value) => {
    if (!quill) return;
    const current = quill.getText().trim().length === 0 ? '' : quill.getSemanticHTML();
    if (value === current) return;
    applyingExternalValue = true;
    quill.setContents([]);
    if (value) quill.clipboard.dangerouslyPasteHTML(value);
    applyingExternalValue = false;
  },
);

onBeforeUnmount(() => {
  quill = null;
});
</script>

<template>
  <div class="quill-host">
    <div ref="container"></div>
  </div>
</template>
