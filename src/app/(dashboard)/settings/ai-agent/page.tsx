"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bot, Save } from "lucide-react";

const formSchema = z.object({
  agentName: z.string().min(1, "Requerido"),
  businessContext: z.string().optional(),
  tone: z.string(),
  language: z.string(),
  welcomeMessage: z.string().optional(),
  fallbackMessage: z.string().optional(),
  humanEscalationMessage: z.string().optional(),
  systemPrompt: z.string().optional(),
  modelProvider: z.string(),
  modelName: z.string(),
  temperature: z.number().min(0).max(1),
});

export default function AIAgentSettingsPage() {
  const [loading, setLoading] = useState(true);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      agentName: "",
      businessContext: "",
      tone: "professional",
      language: "es",
      welcomeMessage: "",
      fallbackMessage: "",
      humanEscalationMessage: "",
      systemPrompt: "",
      modelProvider: "anthropic",
      modelName: "claude-3-5-sonnet-20241022",
      temperature: 0.7,
    },
  });

  useEffect(() => {
    fetch("/api/ai-agent")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          form.reset({
            agentName: data.agentName || "",
            businessContext: data.businessContext || "",
            tone: data.tone || "professional",
            language: data.language || "es",
            welcomeMessage: data.welcomeMessage || "",
            fallbackMessage: data.fallbackMessage || "",
            humanEscalationMessage: data.humanEscalationMessage || "",
            systemPrompt: data.systemPrompt || "",
            modelProvider: data.modelProvider || "anthropic",
            modelName: data.modelName || "claude-3-5-sonnet-20241022",
            temperature: data.temperature || 0.7,
          });
        }
        setLoading(false);
      })
      .catch(() => {
        toast.error("Error al cargar la configuración");
        setLoading(false);
      });
  }, [form]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const res = await fetch("/api/ai-agent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) throw new Error("Error saving");
      toast.success("Configuración del agente guardada correctamente.");
    } catch {
      toast.error("Error al guardar la configuración.");
    }
  }

  if (loading) return <div className="p-8">Cargando configuración del agente...</div>;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
          <Bot className="h-6 w-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agente de IA</h1>
          <p className="text-muted-foreground">Configura el comportamiento y el cerebro de tu asistente virtual.</p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          
          <Card>
            <CardHeader>
              <CardTitle>Identidad y Contexto</CardTitle>
              <CardDescription>Define cómo se presenta el agente y qué información base posee.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="agentName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Agente</FormLabel>
                      <FormControl><Input placeholder="Ej: Sofía" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="language"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Idioma Principal</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un idioma" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="es">Español</SelectItem>
                          <SelectItem value="en">Inglés</SelectItem>
                          <SelectItem value="pt">Portugués</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tono de Conversación</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecciona un tono" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="professional">Profesional y formal</SelectItem>
                        <SelectItem value="friendly">Amigable y cercano</SelectItem>
                        <SelectItem value="direct">Directo y conciso</SelectItem>
                        <SelectItem value="enthusiastic">Entusiasta y persuasivo</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="businessContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contexto del Negocio</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe tu empresa, productos, precios, y la información general que el agente debe saber..."
                        className="h-32"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>Esta información será la base del conocimiento del agente.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mensajes Predeterminados</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje de Bienvenida (Opcional)</FormLabel>
                    <FormControl><Input placeholder="¡Hola! Soy Sofía, ¿en qué puedo ayudarte?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fallbackMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje de Error / Fallback</FormLabel>
                    <FormControl><Input placeholder="Lo siento, tuve un problema. ¿Puedes repetirlo?" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="humanEscalationMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensaje al Escalar a Humano</FormLabel>
                    <FormControl><Input placeholder="Te comunicaré con un agente humano enseguida." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuración Avanzada (Prompts y Modelo)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt (Instrucciones Personalizadas)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Eres un agente de ventas agresivo. Nunca des descuentos..."
                        className="h-32 font-mono text-sm"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="modelProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor de IA</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Proveedor" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="anthropic">Anthropic (Recomendado)</SelectItem>
                          <SelectItem value="openai" disabled>OpenAI (Próximamente)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="modelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl><Input placeholder="claude-3-5-sonnet-20241022" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button type="submit" size="lg" className="gap-2">
              <Save className="h-4 w-4" />
              Guardar Configuración
            </Button>
          </div>

        </form>
      </Form>
    </div>
  );
}
