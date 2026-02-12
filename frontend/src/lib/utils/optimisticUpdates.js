/**
 * Optimistic UI Updates
 * Provide instant feedback for user actions
 */

/**
 * Optimistic delete with rollback on error
 * @param {HTMLElement} element - Element to remove
 * @param {Function} deleteFn - Async delete function
 * @param {Object} options - Options
 */
export async function optimisticDelete(element, deleteFn, options = {}) {
  const {
    onSuccess = null,
    onError = null,
    animationDuration = 300
  } = options;

  if (!element) return;

  // Store original state for rollback
  const parent = element.parentElement;
  const nextSibling = element.nextSibling;
  const originalHTML = element.outerHTML;

  // Optimistically remove with animation
  element.style.transition = `opacity ${animationDuration}ms ease-out, transform ${animationDuration}ms ease-out`;
  element.style.opacity = '0';
  element.style.transform = 'translateX(-20px)';

  // Wait for animation
  await new Promise(resolve => setTimeout(resolve, animationDuration));
  element.remove();

  try {
    // Actually delete
    await deleteFn();

    if (onSuccess) {
      onSuccess();
    }
  } catch (error) {
    console.error('[OptimisticDelete] Failed:', error);

    // Rollback: restore element
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = originalHTML;
    const restoredElement = tempDiv.firstElementChild;

    if (parent) {
      if (nextSibling) {
        parent.insertBefore(restoredElement, nextSibling);
      } else {
        parent.appendChild(restoredElement);
      }

      // Animate back in
      restoredElement.style.opacity = '0';
      restoredElement.style.transform = 'translateX(-20px)';

      setTimeout(() => {
        restoredElement.style.transition = `opacity ${animationDuration}ms ease-out, transform ${animationDuration}ms ease-out`;
        restoredElement.style.opacity = '1';
        restoredElement.style.transform = 'translateX(0)';
      }, 10);
    }

    if (onError) {
      onError(error);
    }

    throw error;
  }
}

/**
 * Optimistic update with rollback on error
 * @param {HTMLElement} element - Element to update
 * @param {Object} newData - New data to display
 * @param {Function} updateFn - Async update function
 * @param {Function} renderFn - Function to render new data
 * @param {Object} options - Options
 */
export async function optimisticUpdate(element, newData, updateFn, renderFn, options = {}) {
  const {
    onSuccess = null,
    onError = null
  } = options;

  if (!element) return;

  // Store original state for rollback
  const originalHTML = element.innerHTML;

  try {
    // Optimistically update UI
    element.innerHTML = renderFn(newData);

    // Actually update on server
    const result = await updateFn(newData);

    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    console.error('[OptimisticUpdate] Failed:', error);

    // Rollback: restore original HTML
    element.innerHTML = originalHTML;

    if (onError) {
      onError(error);
    }

    throw error;
  }
}

/**
 * Optimistic add with rollback on error
 * @param {HTMLElement} container - Container to add to
 * @param {Object} newItem - New item data
 * @param {Function} addFn - Async add function
 * @param {Function} renderFn - Function to render new item
 * @param {Object} options - Options
 */
export async function optimisticAdd(container, newItem, addFn, renderFn, options = {}) {
  const {
    prepend = false,
    onSuccess = null,
    onError = null,
    animationDuration = 300
  } = options;

  if (!container) return;

  // Create temporary element
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = renderFn(newItem);
  const newElement = tempDiv.firstElementChild;

  // Add optimistically with animation
  newElement.style.opacity = '0';
  newElement.style.transform = 'translateY(-10px)';
  newElement.setAttribute('data-optimistic', 'true');

  if (prepend) {
    container.prepend(newElement);
  } else {
    container.appendChild(newElement);
  }

  // Animate in
  setTimeout(() => {
    newElement.style.transition = `opacity ${animationDuration}ms ease-out, transform ${animationDuration}ms ease-out`;
    newElement.style.opacity = '1';
    newElement.style.transform = 'translateY(0)';
  }, 10);

  try {
    // Actually add on server
    const result = await addFn(newItem);

    // Remove optimistic flag
    newElement.removeAttribute('data-optimistic');

    if (onSuccess) {
      onSuccess(result, newElement);
    }

    return result;
  } catch (error) {
    console.error('[OptimisticAdd] Failed:', error);

    // Rollback: remove element
    newElement.style.opacity = '0';
    newElement.style.transform = 'translateY(-10px)';

    setTimeout(() => {
      newElement.remove();
    }, animationDuration);

    if (onError) {
      onError(error);
    }

    throw error;
  }
}

/**
 * Show loading state on button during async operation
 * @param {HTMLButtonElement} button - Button element
 * @param {Function} asyncFn - Async function to execute
 * @param {Object} options - Options
 */
export async function withButtonLoading(button, asyncFn, options = {}) {
  const {
    loadingText = 'Loading...',
    successText = null,
    successDuration = 2000
  } = options;

  if (!button) return asyncFn();

  const originalText = button.textContent;
  const originalDisabled = button.disabled;
  let hadError = false;

  try {
    // Show loading state
    button.disabled = true;
    button.textContent = loadingText;
    button.classList.add('loading');

    // Execute async function
    const result = await asyncFn();

    // Show success state (if specified)
    if (successText) {
      button.textContent = successText;
      button.classList.remove('loading');
      button.classList.add('success');

      await new Promise(resolve => setTimeout(resolve, successDuration));
    }

    return result;
  } catch (error) {
    // Show error state briefly
    button.classList.remove('loading');
    button.classList.add('error');
    button.textContent = 'Failed';

    await new Promise(resolve => setTimeout(resolve, 1500));
    hadError = true;
    throw error;
  } finally {
    // Restore original state unless we want the error to remain visible
    if (!hadError) {
      button.textContent = originalText;
      button.disabled = originalDisabled;
      button.classList.remove('loading', 'success', 'error');
    } else {
      // Re-enable for retry but keep error styling/text visible
      button.disabled = false;
    }
  }
}

/**
 * Optimistic toggle (e.g., for checkboxes, switches)
 * @param {HTMLElement} element - Element to toggle
 * @param {Function} toggleFn - Async toggle function
 * @param {Object} options - Options
 */
export async function optimisticToggle(element, toggleFn, options = {}) {
  const {
    attribute = 'checked',
    onSuccess = null,
    onError = null
  } = options;

  if (!element) return;

  // Store original state
  const originalValue = element.getAttribute(attribute) === 'true' || element.checked;

  // Optimistically toggle
  const newValue = !originalValue;
  if (element.type === 'checkbox') {
    element.checked = newValue;
  } else {
    element.setAttribute(attribute, newValue);
  }

  try {
    // Actually toggle on server
    const result = await toggleFn(newValue);

    if (onSuccess) {
      onSuccess(result);
    }

    return result;
  } catch (error) {
    console.error('[OptimisticToggle] Failed:', error);

    // Rollback
    if (element.type === 'checkbox') {
      element.checked = originalValue;
    } else {
      element.setAttribute(attribute, originalValue);
    }

    if (onError) {
      onError(error);
    }

    throw error;
  }
}

/**
 * Debounced optimistic update (for live input fields)
 * @param {HTMLInputElement} input - Input element
 * @param {Function} updateFn - Async update function
 * @param {Object} options - Options
 */
export function optimisticInput(input, updateFn, options = {}) {
  const {
    debounceMs = 500,
    onSuccess = null,
    onError = null
  } = options;

  let debounceTimer = null;
  let lastSavedValue = input.value;

  const handleInput = () => {
    clearTimeout(debounceTimer);

    // Show pending state
    input.classList.add('pending-save');

    debounceTimer = setTimeout(async () => {
      const newValue = input.value;

      try {
        await updateFn(newValue);

        lastSavedValue = newValue;
        input.classList.remove('pending-save');
        input.classList.add('saved');

        setTimeout(() => {
          input.classList.remove('saved');
        }, 1500);

        if (onSuccess) {
          onSuccess(newValue);
        }
      } catch (error) {
        console.error('[OptimisticInput] Failed:', error);

        // Rollback
        input.value = lastSavedValue;
        input.classList.remove('pending-save');
        input.classList.add('error');

        setTimeout(() => {
          input.classList.remove('error');
        }, 1500);

        if (onError) {
          onError(error);
        }
      }
    }, debounceMs);
  };

  input.addEventListener('input', handleInput);

  // Return cleanup function
  return () => {
    input.removeEventListener('input', handleInput);
    clearTimeout(debounceTimer);
  };
}

export default {
  optimisticDelete,
  optimisticUpdate,
  optimisticAdd,
  withButtonLoading,
  optimisticToggle,
  optimisticInput
};
