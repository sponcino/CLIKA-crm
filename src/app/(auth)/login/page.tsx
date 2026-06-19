"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await signIn("credentials", {
        redirect: false,
        email,
        password,
      })

      if (res?.error) {
        toast.error("Credenciales inválidas")
      } else {
        toast.success("¡Bienvenido!")
        router.push("/inbox")
        router.refresh()
      }
    } catch {
      toast.error("Ocurrió un error inesperado")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-slate-100 dark:from-[#0a0a0a] dark:to-[#111111] p-4 font-sans antialiased">
      <Card className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#ffffff10] shadow-2xl rounded-md">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="flex items-center justify-center font-bold text-3xl tracking-tight text-slate-900 dark:text-white mb-2">
            CLIKA<span className="h-2 w-2 rounded-full bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-[#1ea952] ml-1 self-center"></span>
          </div>
          <CardDescription className="text-slate-500 dark:text-gray-400 text-sm">
            Ingresa a tu cuenta para gestionar tus conversaciones
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="tu@email.com" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-[var(--bg-card)] border-[#ffffff15] text-slate-900 dark:text-white placeholder-gray-600 focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all duration-150"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-600 dark:text-gray-300 uppercase tracking-wider">Contraseña</Label>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-[var(--bg-card)] border-[#ffffff15] text-slate-900 dark:text-white focus-visible:ring-1 focus-visible:ring-whatsapp focus-visible:border-whatsapp rounded-md transition-all duration-150"
              />
            </div>
          </CardContent>
          <CardFooter className="pt-2">
            <Button className="w-full bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-[#1ea952] hover:bg-green-500 dark:bg-whatsapp hover:bg-green-600 dark:hover:bg-[#1ea952]Hover text-black font-semibold rounded-md transition-all duration-150 shadow-md" type="submit" disabled={loading}>
              {loading ? "Ingresando..." : "Ingresar"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
