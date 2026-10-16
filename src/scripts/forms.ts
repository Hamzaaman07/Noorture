/**
 * Shared client behaviour for every form on the site.
 *
 * Three forms need the same things — booking, contact, and the Circle waitlist
 * — so the validation, the error rendering, and the honest "not connected yet"
 * notice live here rather than being written three times and drifting.
 *
 * Design notes that are easy to get wrong and matter for this audience:
 *
 * - Errors are rendered as text next to the field, not colour alone, and the
 *   field gets aria-invalid plus aria-describedby so a screen reader hears the
 *   reason rather than just "invalid".
 * - An error clears as soon as the person fixes it, instead of making them
 *   submit again to find out.
 * - Focus moves to the first bad field on a failed submit, so a one-handed
 *   reader on a phone is not hunting for what went wrong.
 */

export interface FormOptions {
  /** Where submissions go. Null means the handler is not wired yet. */
  endpoint: string | null;
  /** Shown in the not-yet-connected notice as the interim route. */
  fallbackEmail: string;
}

function clearError(field: HTMLElement & { id: string }) {
  field.removeAttribute('aria-invalid');
  field.removeAttribute('aria-describedby');
  field.parentElement?.querySelector('.field__error')?.remove();
}

function showError(field: HTMLElement & { id: string }, message: string) {
  clearError(field);
  const id = `${field.id}-error`;
  const p = document.createElement('p');
  p.className = 'field__error';
  p.id = id;
  p.textContent = message;
  field.setAttribute('aria-invalid', 'true');
  field.setAttribute('aria-describedby', id);
  field.parentElement?.append(p);
}

function messageFor(field: HTMLInputElement) {
  if (field.type === 'email') return 'Please enter an email address we can reply to.';
  if (field.type === 'tel') return 'Please check this phone number.';
  return 'This one is needed.';
}

export function enhanceForms(options: FormOptions) {
  const forms = document.querySelectorAll<HTMLFormElement>('[data-noor-form]');

  for (const form of forms) {
    const status = form.querySelector<HTMLElement>('[data-form-status]');

    form.addEventListener('input', (event) => {
      const field = event.target as HTMLInputElement;
      if (field.getAttribute('aria-invalid') === 'true' && field.checkValidity()) {
        clearError(field);
      }
    });

    form.addEventListener('submit', (event) => {
      const fields = [...form.elements].filter(
        (el): el is HTMLInputElement =>
          'willValidate' in el && (el as HTMLInputElement).willValidate &&
          (el as HTMLInputElement).type !== 'submit',
      );

      let firstBad: HTMLInputElement | null = null;
      for (const field of fields) {
        if (field.checkValidity()) {
          clearError(field);
          continue;
        }
        showError(field, messageFor(field));
        firstBad ??= field;
      }

      if (firstBad) {
        event.preventDefault();
        firstBad.focus();
        return;
      }

      // Wired: let the browser post it.
      if (options.endpoint) return;

      // Not wired: say so plainly rather than pretending the request went
      // somewhere. Someone reaching a booking form at 3am deserves to know
      // their message did not send.
      event.preventDefault();
      if (!status) return;
      status.hidden = false;
      status.innerHTML =
        'This form is not connected yet — it goes live with the rest of the ' +
        `site. In the meantime, email <a href="mailto:${options.fallbackEmail}">` +
        `${options.fallbackEmail}</a> and Hoda will get back to you.`;
      status.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
}
