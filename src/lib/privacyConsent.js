// The Privacy Notice is shown every time the website is opened.
// "Opened" = a new visit: a new tab or window, or coming back after the browser was closed.
// Once the notice is acknowledged it is not shown again while you keep browsing in the same
// tab (so it does not pop up on every page or refresh). sessionStorage is cleared by the
// browser when the tab is closed, which is what makes it appear again on the next visit.
const KEY = 'cvsurc:privacy-notice-seen';

export const hasAcceptedPrivacy = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

export const acceptPrivacy = () => {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* storage unavailable: the notice will simply show again */
  }
};