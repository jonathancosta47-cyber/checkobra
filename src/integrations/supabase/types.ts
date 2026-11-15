export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      convites: {
        Row: {
          aceito_em: string | null
          created_at: string
          criado_por: string | null
          email: string
          empresa_id: string
          id: string
          papel: Database["public"]["Enums"]["papel_usuario"]
        }
        Insert: {
          aceito_em?: string | null
          created_at?: string
          criado_por?: string | null
          email: string
          empresa_id?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Update: {
          aceito_em?: string | null
          created_at?: string
          criado_por?: string | null
          email?: string
          empresa_id?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
        }
        Relationships: [
          {
            foreignKeyName: "convites_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_inspections: {
        Row: {
          created_at: string
          data: Json
          empreendimento_id: string
          empresa_id: string
          id: string
          local_id: string | null
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          empreendimento_id: string
          empresa_id?: string
          id?: string
          local_id?: string | null
          owner_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          empreendimento_id?: string
          empresa_id?: string
          id?: string
          local_id?: string | null
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_inspections_empreendimento_fk"
            columns: ["empresa_id", "empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "delivery_inspections_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_inspections_local_fk"
            columns: ["empresa_id", "empreendimento_id", "local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["empresa_id", "empreendimento_id", "id"]
          },
        ]
      }
      empreendimento_membros: {
        Row: {
          created_at: string
          empreendimento_id: string
          empresa_id: string
          liberado_por: string | null
          perfil_id: string
        }
        Insert: {
          created_at?: string
          empreendimento_id: string
          empresa_id?: string
          liberado_por?: string | null
          perfil_id: string
        }
        Update: {
          created_at?: string
          empreendimento_id?: string
          empresa_id?: string
          liberado_por?: string | null
          perfil_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "empreendimento_membros_empresa_id_empreendimento_id_fkey"
            columns: ["empresa_id", "empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "empreendimento_membros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "empreendimento_membros_empresa_id_perfil_id_fkey"
            columns: ["empresa_id", "perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      empreendimentos: {
        Row: {
          created_at: string
          empresa_id: string
          endereco: string
          foto_path: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["status_obra"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string
          endereco?: string
          foto_path?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["status_obra"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string
          endereco?: string
          foto_path?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["status_obra"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "obras_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empreiteiros: {
        Row: {
          ativo: boolean
          cnpj: string | null
          contato_nome: string
          created_at: string
          email: string
          empresa_id: string
          id: string
          nome: string
          servicos: string[]
          telefone: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj?: string | null
          contato_nome?: string
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          nome: string
          servicos?: string[]
          telefone?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string | null
          contato_nome?: string
          created_at?: string
          email?: string
          empresa_id?: string
          id?: string
          nome?: string
          servicos?: string[]
          telefone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "empreiteiros_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          cnpj: string | null
          created_at: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      fvs_fotos: {
        Row: {
          created_at: string
          empreendimento_id: string
          empresa_id: string
          enviada_por: string | null
          id: string
          inspecao_id: string
          legenda: string
          nao_conformidade_id: string | null
          ordem: number
          resposta_id: string
          storage_path: string
        }
        Insert: {
          created_at?: string
          empreendimento_id: string
          empresa_id?: string
          enviada_por?: string | null
          id?: string
          inspecao_id: string
          legenda?: string
          nao_conformidade_id?: string | null
          ordem?: number
          resposta_id: string
          storage_path: string
        }
        Update: {
          created_at?: string
          empreendimento_id?: string
          empresa_id?: string
          enviada_por?: string | null
          id?: string
          inspecao_id?: string
          legenda?: string
          nao_conformidade_id?: string | null
          ordem?: number
          resposta_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "fotos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fotos_empresa_id_inspecao_id_fkey"
            columns: ["empresa_id", "inspecao_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "fotos_empresa_id_nao_conformidade_id_fkey"
            columns: ["empresa_id", "nao_conformidade_id"]
            isOneToOne: false
            referencedRelation: "nao_conformidades"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "fotos_empresa_id_resposta_id_fkey"
            columns: ["empresa_id", "resposta_id"]
            isOneToOne: false
            referencedRelation: "respostas"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "fvs_fotos_empreendimento_fk"
            columns: ["empresa_id", "empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      inspecoes: {
        Row: {
          assinaturas: Json
          concluida_em: string | null
          created_at: string
          empreendimento_id: string
          empreiteiro_id: string | null
          empresa_id: string
          id: string
          iniciada_em: string
          inspetor_id: string
          local_id: string
          modelo_id: string
          numero: number
          observacoes: string
          pdf_gerado_em: string | null
          pdf_path: string | null
          status: Database["public"]["Enums"]["status_inspecao"]
          updated_at: string
        }
        Insert: {
          assinaturas?: Json
          concluida_em?: string | null
          created_at?: string
          empreendimento_id: string
          empreiteiro_id?: string | null
          empresa_id?: string
          id?: string
          iniciada_em?: string
          inspetor_id?: string
          local_id: string
          modelo_id: string
          numero: number
          observacoes?: string
          pdf_gerado_em?: string | null
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["status_inspecao"]
          updated_at?: string
        }
        Update: {
          assinaturas?: Json
          concluida_em?: string | null
          created_at?: string
          empreendimento_id?: string
          empreiteiro_id?: string | null
          empresa_id?: string
          id?: string
          iniciada_em?: string
          inspetor_id?: string
          local_id?: string
          modelo_id?: string
          numero?: number
          observacoes?: string
          pdf_gerado_em?: string | null
          pdf_path?: string | null
          status?: Database["public"]["Enums"]["status_inspecao"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspecoes_empreiteiro_fk"
            columns: ["empresa_id", "empreiteiro_id"]
            isOneToOne: false
            referencedRelation: "empreiteiros"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "inspecoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspecoes_empresa_id_inspetor_id_fkey"
            columns: ["empresa_id", "inspetor_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "inspecoes_empresa_id_obra_id_fkey"
            columns: ["empresa_id", "empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "inspecoes_empresa_id_obra_id_local_id_fkey"
            columns: ["empresa_id", "empreendimento_id", "local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["empresa_id", "empreendimento_id", "id"]
          },
          {
            foreignKeyName: "inspecoes_modelo_fk"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_fvs"
            referencedColumns: ["id"]
          },
        ]
      }
      locais: {
        Row: {
          created_at: string
          empreendimento_id: string
          empresa_id: string
          id: string
          nome: string
          ordem: number
          pai_id: string | null
          tipo: Database["public"]["Enums"]["tipo_local"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          empreendimento_id: string
          empresa_id?: string
          id?: string
          nome: string
          ordem?: number
          pai_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_local"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          empreendimento_id?: string
          empresa_id?: string
          id?: string
          nome?: string
          ordem?: number
          pai_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_local"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locais_empresa_id_obra_id_fkey"
            columns: ["empresa_id", "empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "locais_empresa_id_obra_id_pai_id_fkey"
            columns: ["empresa_id", "empreendimento_id", "pai_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["empresa_id", "empreendimento_id", "id"]
          },
        ]
      }
      modelo_itens: {
        Row: {
          created_at: string
          criterio: string
          empresa_id: string | null
          exige_foto: boolean
          id: string
          modelo_id: string
          ordem: number
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterio?: string
          empresa_id?: string | null
          exige_foto?: boolean
          id?: string
          modelo_id: string
          ordem?: number
          texto: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterio?: string
          empresa_id?: string | null
          exige_foto?: boolean
          id?: string
          modelo_id?: string
          ordem?: number
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "modelo_itens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "modelo_itens_modelo_fk"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "modelos_fvs"
            referencedColumns: ["id"]
          },
        ]
      }
      modelos_fvs: {
        Row: {
          ativo: boolean
          atual: boolean
          created_at: string
          criado_por: string | null
          descricao: string
          empresa_id: string | null
          grupo_id: string
          id: string
          nome: string
          servico: string
          updated_at: string
          versao: number
        }
        Insert: {
          ativo?: boolean
          atual?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string
          empresa_id?: string | null
          grupo_id: string
          id?: string
          nome: string
          servico?: string
          updated_at?: string
          versao?: number
        }
        Update: {
          ativo?: boolean
          atual?: boolean
          created_at?: string
          criado_por?: string | null
          descricao?: string
          empresa_id?: string | null
          grupo_id?: string
          id?: string
          nome?: string
          servico?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "modelos_fvs_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      nao_conformidades: {
        Row: {
          aberta_por: string | null
          created_at: string
          descricao: string
          empresa_id: string
          id: string
          inspecao_id: string
          prazo: string | null
          resolvida_em: string | null
          responsavel: string
          resposta_id: string | null
          status: Database["public"]["Enums"]["status_nc"]
          updated_at: string
          verificada_em: string | null
          verificada_por: string | null
        }
        Insert: {
          aberta_por?: string | null
          created_at?: string
          descricao: string
          empresa_id?: string
          id?: string
          inspecao_id: string
          prazo?: string | null
          resolvida_em?: string | null
          responsavel?: string
          resposta_id?: string | null
          status?: Database["public"]["Enums"]["status_nc"]
          updated_at?: string
          verificada_em?: string | null
          verificada_por?: string | null
        }
        Update: {
          aberta_por?: string | null
          created_at?: string
          descricao?: string
          empresa_id?: string
          id?: string
          inspecao_id?: string
          prazo?: string | null
          resolvida_em?: string | null
          responsavel?: string
          resposta_id?: string | null
          status?: Database["public"]["Enums"]["status_nc"]
          updated_at?: string
          verificada_em?: string | null
          verificada_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nao_conformidades_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nao_conformidades_empresa_id_inspecao_id_fkey"
            columns: ["empresa_id", "inspecao_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "nao_conformidades_empresa_id_resposta_id_fkey"
            columns: ["empresa_id", "resposta_id"]
            isOneToOne: false
            referencedRelation: "respostas"
            referencedColumns: ["empresa_id", "id"]
          },
        ]
      }
      ordens_servico: {
        Row: {
          created_at: string
          criado_por: string | null
          dados: Json
          empreendimento_id: string
          empresa_id: string
          id: string
          local_id: string | null
          numero: number
          status: Database["public"]["Enums"]["status_os"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          dados?: Json
          empreendimento_id: string
          empresa_id?: string
          id?: string
          local_id?: string | null
          numero: number
          status?: Database["public"]["Enums"]["status_os"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          dados?: Json
          empreendimento_id?: string
          empresa_id?: string
          id?: string
          local_id?: string | null
          numero?: number
          status?: Database["public"]["Enums"]["status_os"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ordens_servico_empresa_id_empreendimento_id_fkey"
            columns: ["empresa_id", "empreendimento_id"]
            isOneToOne: false
            referencedRelation: "empreendimentos"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "ordens_servico_empresa_id_empreendimento_id_local_id_fkey"
            columns: ["empresa_id", "empreendimento_id", "local_id"]
            isOneToOne: false
            referencedRelation: "locais"
            referencedColumns: ["empresa_id", "empreendimento_id", "id"]
          },
          {
            foreignKeyName: "ordens_servico_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          created_at: string
          empresa_id: string
          id: string
          nome: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          empresa_id: string
          id: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          empresa_id?: string
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfis_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas: {
        Row: {
          created_at: string
          criterio: string
          empresa_id: string
          exige_foto: boolean
          id: string
          inspecao_id: string
          item_id: string | null
          observacao: string
          ordem: number
          resultado: Database["public"]["Enums"]["resultado_item"] | null
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criterio?: string
          empresa_id?: string
          exige_foto?: boolean
          id?: string
          inspecao_id: string
          item_id?: string | null
          observacao?: string
          ordem?: number
          resultado?: Database["public"]["Enums"]["resultado_item"] | null
          texto: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criterio?: string
          empresa_id?: string
          exige_foto?: boolean
          id?: string
          inspecao_id?: string
          item_id?: string | null
          observacao?: string
          ordem?: number
          resultado?: Database["public"]["Enums"]["resultado_item"] | null
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_empresa_id_inspecao_id_fkey"
            columns: ["empresa_id", "inspecao_id"]
            isOneToOne: false
            referencedRelation: "inspecoes"
            referencedColumns: ["empresa_id", "id"]
          },
          {
            foreignKeyName: "respostas_item_fk"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "modelo_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      super_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      aceitar_convite: { Args: { p_nome_usuario?: string }; Returns: string }
      caminho_da_fvs: { Args: { p_nome: string }; Returns: string }
      criar_empreendimento: {
        Args: {
          p_areas_comuns?: string[]
          p_endereco?: string
          p_nome: string
          p_pavimentos?: number
          p_torres?: number
          p_unidades?: number
        }
        Returns: string
      }
      criar_empresa: {
        Args: { p_nome: string; p_nome_usuario?: string }
        Returns: string
      }
      duplicar_modelo: {
        Args: { p_modelo_id: string; p_nome?: string }
        Returns: string
      }
      meu_papel: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      minha_empresa_id: { Args: never; Returns: string }
      pode_editar_inspecao: { Args: { p_inspecao: string }; Returns: boolean }
      pode_ver_empreendimento: {
        Args: { p_empreendimento: string }
        Returns: boolean
      }
      pode_ver_inspecao: { Args: { p_inspecao: string }; Returns: boolean }
      registrar_pdf_fvs: {
        Args: { p_inspecao: string; p_path: string }
        Returns: undefined
      }
      salvar_modelo: {
        Args: {
          p_itens: Json
          p_modelo_id: string
          p_nome: string
          p_padrao?: boolean
          p_servico: string
        }
        Returns: string
      }
      sou_super_admin: { Args: never; Returns: boolean }
      tem_papel: {
        Args: { papeis: Database["public"]["Enums"]["papel_usuario"][] }
        Returns: boolean
      }
      uuid_ou_nulo: { Args: { p: string }; Returns: string }
    }
    Enums: {
      papel_usuario: "admin_empresa" | "engenheiro" | "inspetor"
      resultado_item: "C" | "NC" | "NA"
      status_inspecao: "rascunho" | "concluida" | "cancelada"
      status_nc: "aberta" | "em_correcao" | "resolvida" | "verificada"
      status_obra: "ativa" | "pausada" | "concluida"
      status_os: "aberta" | "em_andamento" | "concluida"
      tipo_local: "torre" | "pavimento" | "unidade" | "area_comum"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      papel_usuario: ["admin_empresa", "engenheiro", "inspetor"],
      resultado_item: ["C", "NC", "NA"],
      status_inspecao: ["rascunho", "concluida", "cancelada"],
      status_nc: ["aberta", "em_correcao", "resolvida", "verificada"],
      status_obra: ["ativa", "pausada", "concluida"],
      status_os: ["aberta", "em_andamento", "concluida"],
      tipo_local: ["torre", "pavimento", "unidade", "area_comum"],
    },
  },
} as const
