import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/password";

describe("password rules", () => {
  it("everyone: 8+ characters, not common", () => {
    expect(passwordProblem("short1")).toMatch(/8 characters/);
    expect(passwordProblem("pakistan123")).toMatch(/too common/);
    expect(passwordProblem("bluehouse")).toBeNull();
  });

  it("owners also need a letter, a number, a symbol and no phone number", () => {
    const o = { strong: true, phone: "+923024648462" };
    expect(passwordProblem("bluehouse", o)).toMatch(/letter and a number/);
    expect(passwordProblem("bluehouse7", o)).toMatch(/symbol/);
    expect(passwordProblem("k4648462@", o)).toMatch(/phone number/);
    expect(passwordProblem("Kmsa@2026", o)).toBeNull();
    expect(passwordProblem("p@ssw0rd", o)).toMatch(/too common/);
  });
});
