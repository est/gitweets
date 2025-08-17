export function getCookie(cookie_str, name) {
    return decodeURIComponent(cookie_str || ''
        .split(";")
        .find(row => row.trim().startsWith(name + "="))
        ?.split("=")[1]?.trim() || '');
}
