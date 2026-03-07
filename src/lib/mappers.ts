export function toAgeBandEnum(value: string) {
  if (value === "13-15") return "age_13_15";
  if (value === "16-18") return "age_16_18";
  return "age_18_24";
}

export function fromAgeBandEnum(value: string) {
  if (value === "age_13_15") return "13-15";
  if (value === "age_16_18") return "16-18";
  return "18-24";
}
