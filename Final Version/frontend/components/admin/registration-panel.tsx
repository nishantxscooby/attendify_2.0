"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { RegisterForm } from "@/components/auth/register-form"
import { UserPlus, GraduationCap, UserCheck } from "lucide-react"

export function RegistrationPanel() {
  const [activeTab, setActiveTab] = useState("student")
  const [registrationSuccess, setRegistrationSuccess] = useState(false)

  const handleRegistrationSuccess = () => {
    setRegistrationSuccess(true)
    setTimeout(() => {
      setRegistrationSuccess(false)
    }, 3000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          User Registration
        </CardTitle>
        <CardDescription>Register new students and teachers in the system</CardDescription>
      </CardHeader>
      <CardContent>
        {registrationSuccess && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-sm text-green-800">User registered successfully!</p>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="student" className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4" />
              Student
            </TabsTrigger>
            <TabsTrigger value="teacher" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Teacher
            </TabsTrigger>
          </TabsList>

          <TabsContent value="student" className="mt-4">
            <RegisterForm userType="student" onSuccess={handleRegistrationSuccess} />
          </TabsContent>

          <TabsContent value="teacher" className="mt-4">
            <RegisterForm userType="teacher" onSuccess={handleRegistrationSuccess} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
