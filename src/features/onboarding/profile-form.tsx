"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProfileFormProps = {
  guestSessionToken: string;
};

export function ProfileForm({ guestSessionToken }: ProfileFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    ageBand: "16-18",
    targetLanguage: "spanish",
    nativeLanguage: "english",
    isTakingClass: "yes",
    schoolLevel: "high_school",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    await fetch("/api/v1/onboarding/session/profile", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        guestSessionToken,
        firstName: form.firstName,
        ageBand: form.ageBand,
        targetLanguage: form.targetLanguage,
        nativeLanguage: form.nativeLanguage,
        isTakingClass: form.isTakingClass === "yes",
        schoolLevel: form.schoolLevel,
      }),
    });

    router.push("/onboarding/assessment");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="firstName">First name</Label>
        <Input
          id="firstName"
          value={form.firstName}
          onChange={(event) =>
            setForm((current) => ({ ...current, firstName: event.target.value }))
          }
          placeholder="Chris"
          required
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <SelectField
          label="Age band"
          value={form.ageBand}
          onValueChange={(value) => setForm((current) => ({ ...current, ageBand: value }))}
          options={[
            { value: "13-15", label: "13-15" },
            { value: "16-18", label: "16-18" },
            { value: "18-24", label: "18-24" },
          ]}
        />
        <SelectField
          label="School level"
          value={form.schoolLevel}
          onValueChange={(value) => setForm((current) => ({ ...current, schoolLevel: value }))}
          options={[
            { value: "high_school", label: "High school" },
            { value: "college", label: "College" },
          ]}
        />
        <SelectField
          label="Target language"
          value={form.targetLanguage}
          onValueChange={(value) => setForm((current) => ({ ...current, targetLanguage: value }))}
          options={[
            { value: "english", label: "English" },
            { value: "spanish", label: "Spanish" },
            { value: "chinese", label: "Chinese" },
          ]}
        />
        <SelectField
          label="Native language"
          value={form.nativeLanguage}
          onValueChange={(value) => setForm((current) => ({ ...current, nativeLanguage: value }))}
          options={[
            { value: "english", label: "English" },
            { value: "spanish", label: "Spanish" },
            { value: "chinese", label: "Chinese" },
          ]}
        />
      </div>
      <SelectField
        label="Are you taking a language class right now?"
        value={form.isTakingClass}
        onValueChange={(value) => setForm((current) => ({ ...current, isTakingClass: value }))}
        options={[
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]}
      />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Saving..." : "Continue to assessment"}
      </Button>
    </form>
  );
}

function SelectField({
  label,
  value,
  onValueChange,
  options,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

