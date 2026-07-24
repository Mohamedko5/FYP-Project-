import { createPortal } from 'react-dom';

/**
 * Renders children into document.body so that fixed-position backdrops
 * truly cover the full viewport — including the header, sidebar, and
 * bottom white area — regardless of any stacking context on ancestor elements.
 *
 * Usage: wrap any backdrop root element with <ModalPortal>.
 * All existing CSS class names are preserved; only the DOM insertion point changes.
 */
export default function ModalPortal({ children }) {
  return createPortal(children, document.body);
}
