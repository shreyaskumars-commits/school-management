const isText = (v) =>
  typeof v === "string" && v.trim() !== "";
const isYear = (v) =>
  Number.isInteger(v) && v >= 1 && v <= 4;

export function checkValues({ name, department, year }) {
  if (name !== undefined && !isText(name)) {
    return "name must be text";
  }
  if (department !== undefined && !isText(department)) {
    return "department must be text";
  }
  if (year !== undefined && !isYear(year)) {
    return "year must be a whole number from 1 to 4";
  }
}
