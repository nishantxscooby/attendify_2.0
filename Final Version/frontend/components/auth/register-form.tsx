"use client";

import type React from "react";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, EyeOff, Upload, X } from "lucide-react";

interface RegisterFormProps {
  userType: "student" | "teacher";
  onSuccess?: () => void;
}

type PhotoState = {
  file: File | null;
  previewUrl: string | null;
  error: string | null;
};

const MAX_PHOTO_MB = 5;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function RegisterForm({ userType, onSuccess }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    phone: "",
    // Student specific
    rollNo: "",
    classCode: "",
    course: "",
    year: "",
    // Teacher specific
    department: "",
    designation: "",
  });

  const [photo, setPhoto] = useState<PhotoState>({ file: null, previewUrl: null, error: null });

  const endpoint = useMemo(
    () => (userType === "student" ? "/api/register-student" : "/api/register-teacher"),
    [userType]
  );

  function handleInputChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function clearPhoto() {
    if (photo.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setPhoto({ file: null, previewUrl: null, error: null });
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      clearPhoto();
      return;
    }

    // validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setPhoto({
        file: null,
        previewUrl: null,
        error: "Only JPG, PNG, or WebP images are allowed.",
      });
      return;
    }

    // validate size
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > MAX_PHOTO_MB) {
      setPhoto({
        file: null,
        previewUrl: null,
        error: `Image is too large (${sizeMb.toFixed(1)}MB). Max ${MAX_PHOTO_MB}MB.`,
      });
      return;
    }

    // create preview
    const url = URL.createObjectURL(file);
    setPhoto({ file, previewUrl: url, error: null });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Basic required checks
      if (!formData.username || !formData.password || !formData.name || !formData.email || !formData.phone) {
        throw new Error("Please fill all required fields.");
      }
      if (userType === "student") {
        if (!formData.rollNo || !formData.classCode || !formData.course || !formData.year) {
          throw new Error("Please complete all student fields.");
        }
      } else {
        if (!formData.department || !formData.designation) {
          throw new Error("Please complete all teacher fields.");
        }
      }

      // Build multipart body (photo + JSON fields)
      const body = new FormData();
      body.append("userType", userType);
      Object.entries(formData).forEach(([k, v]) => body.append(k, v));
      if (photo.file) body.append("photo", photo.file);

      // NOTE: endpoint must accept multipart/form-data via req.formData()
      const res = await fetch(endpoint, {
        method: "POST",
        body,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Registration failed");

      // success
      onSuccess?.();
      // reset form
      setFormData({
        username: "",
        password: "",
        name: "",
        email: "",
        phone: "",
        rollNo: "",
        classCode: "",
        course: "",
        year: "",
        department: "",
        designation: "",
      });
      clearPhoto();
    } catch (err: any) {
      alert(err?.message ?? "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-center">
          Register {userType === "student" ? "Student" : "Teacher"}
        </CardTitle>
        <CardDescription className="text-center">Create a new {userType} account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {/* Photo uploader */}
          <div className="grid gap-2">
            <Label htmlFor="photo">Profile Photo (optional)</Label>
            <div className="flex items-start gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border">
                {photo.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.previewUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    No Photo
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Input id="photo" type="file" accept="image/*" onChange={handlePhotoChange} />
                  {photo.file && (
                    <Button type="button" variant="outline" size="icon" onClick={clearPhoto} title="Remove">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepted: JPG, PNG, WebP. Max size {MAX_PHOTO_MB}MB.
                </p>
                {photo.error && <p className="text-xs text-red-600">{photo.error}</p>}
              </div>
            </div>
          </div>

          {/* Core fields */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Enter username"
                value={formData.username}
                onChange={(e) => handleInputChange("username", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Enter phone number"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                required
              />
            </div>
          </div>

          {userType === "student" && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rollNo">Roll Number</Label>
                  <Input
                    id="rollNo"
                    type="text"
                    placeholder="Enter roll number"
                    value={formData.rollNo}
                    onChange={(e) => handleInputChange("rollNo", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="classCode">Class Code</Label>
                  <Input
                    id="classCode"
                    type="text"
                    placeholder="Enter class code"
                    value={formData.classCode}
                    onChange={(e) => handleInputChange("classCode", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="course">Course</Label>
                  <Input
                    id="course"
                    type="text"
                    placeholder="Enter course"
                    value={formData.course}
                    onChange={(e) => handleInputChange("course", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Select value={formData.year} onValueChange={(v) => handleInputChange("year", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1st Year</SelectItem>
                      <SelectItem value="2">2nd Year</SelectItem>
                      <SelectItem value="3">3rd Year</SelectItem>
                      <SelectItem value="4">4th Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {userType === "teacher" && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  type="text"
                  placeholder="Enter department"
                  value={formData.department}
                  onChange={(e) => handleInputChange("department", e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="designation">Designation</Label>
                <Input
                  id="designation"
                  type="text"
                  placeholder="Enter designation"
                  value={formData.designation}
                  onChange={(e) => handleInputChange("designation", e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Registering..." : `Register ${userType === "student" ? "Student" : "Teacher"}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
