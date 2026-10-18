export const send = (xhr: XMLHttpRequest) => {
  xhr.withCredentials = true;
  xhr.send();
};
