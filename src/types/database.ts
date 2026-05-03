Connecting to db 5432
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      anwesenheit: {
        Row: {
          erfasst_am: string | null
          erfasst_von: string | null
          fortschritt: Database["public"]["Enums"]["lernfortschritt"] | null
          notiz: string | null
          schueler_id: string
          status: Database["public"]["Enums"]["anwesenheit_status"] | null
          stunde_id: string
        }
        Insert: {
          erfasst_am?: string | null
          erfasst_von?: string | null
          fortschritt?: Database["public"]["Enums"]["lernfortschritt"] | null
          notiz?: string | null
          schueler_id: string
          status?: Database["public"]["Enums"]["anwesenheit_status"] | null
          stunde_id: string
        }
        Update: {
          erfasst_am?: string | null
          erfasst_von?: string | null
          fortschritt?: Database["public"]["Enums"]["lernfortschritt"] | null
          notiz?: string | null
          schueler_id?: string
          status?: Database["public"]["Enums"]["anwesenheit_status"] | null
          stunde_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "anwesenheit_erfasst_von_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anwesenheit_erfasst_von_fkey"
            columns: ["erfasst_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anwesenheit_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anwesenheit_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "anwesenheit_stunde_id_fkey"
            columns: ["stunde_id"]
            isOneToOne: false
            referencedRelation: "stunden"
            referencedColumns: ["id"]
          },
        ]
      }
      dateien: {
        Row: {
          beschreibung: string | null
          bucket_pfad: string
          hochgeladen_am: string | null
          hochgeladen_von: string | null
          id: string
          name: string
          schueler_id: string | null
          schule_id: string
          typ: Database["public"]["Enums"]["datei_typ"] | null
          unterricht_id: string | null
        }
        Insert: {
          beschreibung?: string | null
          bucket_pfad: string
          hochgeladen_am?: string | null
          hochgeladen_von?: string | null
          id?: string
          name: string
          schueler_id?: string | null
          schule_id?: string
          typ?: Database["public"]["Enums"]["datei_typ"] | null
          unterricht_id?: string | null
        }
        Update: {
          beschreibung?: string | null
          bucket_pfad?: string
          hochgeladen_am?: string | null
          hochgeladen_von?: string | null
          id?: string
          name?: string
          schueler_id?: string | null
          schule_id?: string
          typ?: Database["public"]["Enums"]["datei_typ"] | null
          unterricht_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dateien_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dateien_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      eltern_schueler: {
        Row: {
          eltern_id: string
          schueler_id: string
        }
        Insert: {
          eltern_id: string
          schueler_id: string
        }
        Update: {
          eltern_id?: string
          schueler_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eltern_schueler_eltern_id_fkey"
            columns: ["eltern_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eltern_schueler_eltern_id_fkey"
            columns: ["eltern_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eltern_schueler_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eltern_schueler_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_stuecke: {
        Row: {
          event_id: string
          interpret: string | null
          reihenfolge: number | null
          stueck_id: string
        }
        Insert: {
          event_id: string
          interpret?: string | null
          reihenfolge?: number | null
          stueck_id: string
        }
        Update: {
          event_id?: string
          interpret?: string | null
          reihenfolge?: number | null
          stueck_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_stuecke_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_stuecke_stueck_id_fkey"
            columns: ["stueck_id"]
            isOneToOne: false
            referencedRelation: "stuecke"
            referencedColumns: ["id"]
          },
        ]
      }
      event_teilnehmer: {
        Row: {
          event_id: string
          profil_id: string
          rolle: string | null
          zusage: Database["public"]["Enums"]["zusage_status"] | null
        }
        Insert: {
          event_id: string
          profil_id: string
          rolle?: string | null
          zusage?: Database["public"]["Enums"]["zusage_status"] | null
        }
        Update: {
          event_id?: string
          profil_id?: string
          rolle?: string | null
          zusage?: Database["public"]["Enums"]["zusage_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "event_teilnehmer_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_teilnehmer_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_teilnehmer_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          beginn: string
          beschreibung: string | null
          ende: string | null
          erstellt_am: string | null
          erstellt_von: string | null
          id: string
          oeffentlich: boolean | null
          ort: string | null
          raum_id: string | null
          schule_id: string
          titel: string
          typ: Database["public"]["Enums"]["event_typ"]
        }
        Insert: {
          beginn: string
          beschreibung?: string | null
          ende?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          oeffentlich?: boolean | null
          ort?: string | null
          raum_id?: string | null
          schule_id?: string
          titel: string
          typ?: Database["public"]["Enums"]["event_typ"]
        }
        Update: {
          beginn?: string
          beschreibung?: string | null
          ende?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          oeffentlich?: boolean | null
          ort?: string | null
          raum_id?: string | null
          schule_id?: string
          titel?: string
          typ?: Database["public"]["Enums"]["event_typ"]
        }
        Relationships: [
          {
            foreignKeyName: "events_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raeume"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      instrumente: {
        Row: {
          aktiv: boolean | null
          icon: string | null
          id: string
          name_de: string
          name_en: string | null
          name_tr: string | null
          schule_id: string
        }
        Insert: {
          aktiv?: boolean | null
          icon?: string | null
          id?: string
          name_de: string
          name_en?: string | null
          name_tr?: string | null
          schule_id?: string
        }
        Update: {
          aktiv?: boolean | null
          icon?: string | null
          id?: string
          name_de?: string
          name_en?: string | null
          name_tr?: string | null
          schule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrumente_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      interessenten: {
        Row: {
          angemeldet_am: string | null
          email: string | null
          geburtsdatum: string | null
          id: string
          instrument_id: string | null
          notizen: string | null
          probe_datum: string | null
          probe_raum_id: string | null
          schule_id: string
          status: Database["public"]["Enums"]["schueler_status"] | null
          telefon: string | null
          voller_name: string
          wunsch_lehrer: string | null
        }
        Insert: {
          angemeldet_am?: string | null
          email?: string | null
          geburtsdatum?: string | null
          id?: string
          instrument_id?: string | null
          notizen?: string | null
          probe_datum?: string | null
          probe_raum_id?: string | null
          schule_id?: string
          status?: Database["public"]["Enums"]["schueler_status"] | null
          telefon?: string | null
          voller_name: string
          wunsch_lehrer?: string | null
        }
        Update: {
          angemeldet_am?: string | null
          email?: string | null
          geburtsdatum?: string | null
          id?: string
          instrument_id?: string | null
          notizen?: string | null
          probe_datum?: string | null
          probe_raum_id?: string | null
          schule_id?: string
          status?: Database["public"]["Enums"]["schueler_status"] | null
          telefon?: string | null
          voller_name?: string
          wunsch_lehrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interessenten_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instrumente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interessenten_probe_raum_id_fkey"
            columns: ["probe_raum_id"]
            isOneToOne: false
            referencedRelation: "raeume"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interessenten_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interessenten_wunsch_lehrer_fkey"
            columns: ["wunsch_lehrer"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interessenten_wunsch_lehrer_fkey"
            columns: ["wunsch_lehrer"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kalender_tokens: {
        Row: {
          erstellt_am: string | null
          id: string
          token: string
          user_id: string
        }
        Insert: {
          erstellt_am?: string | null
          id?: string
          token?: string
          user_id: string
        }
        Update: {
          erstellt_am?: string | null
          id?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kalender_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kalender_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lehrer_instrumente: {
        Row: {
          instrument_id: string
          lehrer_id: string
        }
        Insert: {
          instrument_id: string
          lehrer_id: string
        }
        Update: {
          instrument_id?: string
          lehrer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lehrer_instrumente_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instrumente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lehrer_instrumente_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lehrer_instrumente_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mitglied_dateien: {
        Row: {
          bucket_pfad: string
          hochgeladen_am: string | null
          hochgeladen_von: string | null
          id: string
          name: string
          profil_id: string
          typ: string
        }
        Insert: {
          bucket_pfad: string
          hochgeladen_am?: string | null
          hochgeladen_von?: string | null
          id?: string
          name: string
          profil_id: string
          typ?: string
        }
        Update: {
          bucket_pfad?: string
          hochgeladen_am?: string | null
          hochgeladen_von?: string | null
          id?: string
          name?: string
          profil_id?: string
          typ?: string
        }
        Relationships: [
          {
            foreignKeyName: "mitglied_dateien_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mitglied_dateien_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mitglied_dateien_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mitglied_dateien_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nachricht_gelesen: {
        Row: {
          gelesen_am: string | null
          nachricht_id: string
          user_id: string
        }
        Insert: {
          gelesen_am?: string | null
          nachricht_id: string
          user_id: string
        }
        Update: {
          gelesen_am?: string | null
          nachricht_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nachricht_gelesen_nachricht_id_fkey"
            columns: ["nachricht_id"]
            isOneToOne: false
            referencedRelation: "nachrichten"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nachricht_gelesen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nachricht_gelesen_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      nachrichten: {
        Row: {
          betreff: string
          empfaenger_id: string | null
          gesendet_am: string | null
          gesendet_von: string | null
          id: string
          inhalt: string
          schule_id: string
          typ: Database["public"]["Enums"]["nachricht_typ"] | null
        }
        Insert: {
          betreff: string
          empfaenger_id?: string | null
          gesendet_am?: string | null
          gesendet_von?: string | null
          id?: string
          inhalt: string
          schule_id?: string
          typ?: Database["public"]["Enums"]["nachricht_typ"] | null
        }
        Update: {
          betreff?: string
          empfaenger_id?: string | null
          gesendet_am?: string | null
          gesendet_von?: string | null
          id?: string
          inhalt?: string
          schule_id?: string
          typ?: Database["public"]["Enums"]["nachricht_typ"] | null
        }
        Relationships: [
          {
            foreignKeyName: "nachrichten_empfaenger_id_fkey"
            columns: ["empfaenger_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nachrichten_empfaenger_id_fkey"
            columns: ["empfaenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nachrichten_gesendet_von_fkey"
            columns: ["gesendet_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nachrichten_gesendet_von_fkey"
            columns: ["gesendet_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nachrichten_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      pakete: {
        Row: {
          gekauft_am: string | null
          gueltig_bis: string | null
          id: string
          notizen: string | null
          preis: number | null
          schueler_id: string
          stunden_genutzt: number | null
          stunden_gesamt: number
          unterricht_id: string | null
        }
        Insert: {
          gekauft_am?: string | null
          gueltig_bis?: string | null
          id?: string
          notizen?: string | null
          preis?: number | null
          schueler_id: string
          stunden_genutzt?: number | null
          stunden_gesamt: number
          unterricht_id?: string | null
        }
        Update: {
          gekauft_am?: string | null
          gueltig_bis?: string | null
          id?: string
          notizen?: string | null
          preis?: number | null
          schueler_id?: string
          stunden_genutzt?: number | null
          stunden_gesamt?: number
          unterricht_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pakete_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pakete_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pakete_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          adresse: string | null
          aktiv: boolean | null
          aktualisiert_am: string | null
          avatar_url: string | null
          erstellt_am: string | null
          geburtsdatum: string | null
          id: string
          notizen: string | null
          rolle: Database["public"]["Enums"]["user_rolle"]
          schule_id: string
          sprache: Database["public"]["Enums"]["sprache"] | null
          telefon: string | null
          voller_name: string
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          avatar_url?: string | null
          erstellt_am?: string | null
          geburtsdatum?: string | null
          id: string
          notizen?: string | null
          rolle?: Database["public"]["Enums"]["user_rolle"]
          schule_id?: string
          sprache?: Database["public"]["Enums"]["sprache"] | null
          telefon?: string | null
          voller_name: string
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean | null
          aktualisiert_am?: string | null
          avatar_url?: string | null
          erstellt_am?: string | null
          geburtsdatum?: string | null
          id?: string
          notizen?: string | null
          rolle?: Database["public"]["Enums"]["user_rolle"]
          schule_id?: string
          sprache?: Database["public"]["Enums"]["sprache"] | null
          telefon?: string | null
          voller_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          endpoint: string
          erstellt_am: string | null
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth_key: string
          endpoint: string
          erstellt_am?: string | null
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth_key?: string
          endpoint?: string
          erstellt_am?: string | null
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      raeume: {
        Row: {
          aktiv: boolean | null
          ausstattung: string[] | null
          farbe: string | null
          id: string
          kapazitaet: number | null
          name: string
          notizen: string | null
          schule_id: string
        }
        Insert: {
          aktiv?: boolean | null
          ausstattung?: string[] | null
          farbe?: string | null
          id?: string
          kapazitaet?: number | null
          name: string
          notizen?: string | null
          schule_id?: string
        }
        Update: {
          aktiv?: boolean | null
          ausstattung?: string[] | null
          farbe?: string | null
          id?: string
          kapazitaet?: number | null
          name?: string
          notizen?: string | null
          schule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "raeume_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      rechnungen: {
        Row: {
          betrag: number
          bezahlt_am: string | null
          erstellt_am: string | null
          faellig_am: string | null
          id: string
          notizen: string | null
          schueler_id: string
          schule_id: string
          unterricht_id: string | null
          zeitraum_bis: string | null
          zeitraum_von: string | null
        }
        Insert: {
          betrag: number
          bezahlt_am?: string | null
          erstellt_am?: string | null
          faellig_am?: string | null
          id?: string
          notizen?: string | null
          schueler_id: string
          schule_id?: string
          unterricht_id?: string | null
          zeitraum_bis?: string | null
          zeitraum_von?: string | null
        }
        Update: {
          betrag?: number
          bezahlt_am?: string | null
          erstellt_am?: string | null
          faellig_am?: string | null
          id?: string
          notizen?: string | null
          schueler_id?: string
          schule_id?: string
          unterricht_id?: string | null
          zeitraum_bis?: string | null
          zeitraum_von?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rechnungen_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungen_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungen_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rechnungen_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      schulen: {
        Row: {
          adresse: string | null
          aktiv: boolean | null
          email: string | null
          erstellt_am: string | null
          farbe: string | null
          id: string
          logo_url: string | null
          name: string
          sprachen: Database["public"]["Enums"]["sprache"][] | null
          telefon: string | null
          website: string | null
          zeitzone: string
        }
        Insert: {
          adresse?: string | null
          aktiv?: boolean | null
          email?: string | null
          erstellt_am?: string | null
          farbe?: string | null
          id?: string
          logo_url?: string | null
          name: string
          sprachen?: Database["public"]["Enums"]["sprache"][] | null
          telefon?: string | null
          website?: string | null
          zeitzone?: string
        }
        Update: {
          adresse?: string | null
          aktiv?: boolean | null
          email?: string | null
          erstellt_am?: string | null
          farbe?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          sprachen?: Database["public"]["Enums"]["sprache"][] | null
          telefon?: string | null
          website?: string | null
          zeitzone?: string
        }
        Relationships: []
      }
      session_reaktionen: {
        Row: {
          beantwortet: boolean | null
          erstellt_am: string | null
          frage: string | null
          gast_name: string | null
          id: string
          profil_id: string | null
          session_id: string
          typ: Database["public"]["Enums"]["reaktion_typ"] | null
        }
        Insert: {
          beantwortet?: boolean | null
          erstellt_am?: string | null
          frage?: string | null
          gast_name?: string | null
          id?: string
          profil_id?: string | null
          session_id: string
          typ?: Database["public"]["Enums"]["reaktion_typ"] | null
        }
        Update: {
          beantwortet?: boolean | null
          erstellt_am?: string | null
          frage?: string | null
          gast_name?: string | null
          id?: string
          profil_id?: string | null
          session_id?: string
          typ?: Database["public"]["Enums"]["reaktion_typ"] | null
        }
        Relationships: [
          {
            foreignKeyName: "session_reaktionen_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reaktionen_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_reaktionen_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "unterricht_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_teilnehmer: {
        Row: {
          beigetreten_am: string | null
          gast_name: string | null
          profil_id: string
          session_id: string
          zuletzt_aktiv: string | null
        }
        Insert: {
          beigetreten_am?: string | null
          gast_name?: string | null
          profil_id: string
          session_id: string
          zuletzt_aktiv?: string | null
        }
        Update: {
          beigetreten_am?: string | null
          gast_name?: string | null
          profil_id?: string
          session_id?: string
          zuletzt_aktiv?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_teilnehmer_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_teilnehmer_profil_id_fkey"
            columns: ["profil_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_teilnehmer_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "unterricht_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      stueck_dateien: {
        Row: {
          bucket_pfad: string
          hochgeladen_am: string | null
          hochgeladen_von: string | null
          id: string
          name: string
          stimme: Database["public"]["Enums"]["stimmgruppe_typ"] | null
          stueck_id: string | null
          typ: Database["public"]["Enums"]["datei_typ"]
        }
        Insert: {
          bucket_pfad: string
          hochgeladen_am?: string | null
          hochgeladen_von?: string | null
          id?: string
          name: string
          stimme?: Database["public"]["Enums"]["stimmgruppe_typ"] | null
          stueck_id?: string | null
          typ: Database["public"]["Enums"]["datei_typ"]
        }
        Update: {
          bucket_pfad?: string
          hochgeladen_am?: string | null
          hochgeladen_von?: string | null
          id?: string
          name?: string
          stimme?: Database["public"]["Enums"]["stimmgruppe_typ"] | null
          stueck_id?: string | null
          typ?: Database["public"]["Enums"]["datei_typ"]
        }
        Relationships: [
          {
            foreignKeyName: "stueck_dateien_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stueck_dateien_hochgeladen_von_fkey"
            columns: ["hochgeladen_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stueck_dateien_stueck_id_fkey"
            columns: ["stueck_id"]
            isOneToOne: false
            referencedRelation: "stuecke"
            referencedColumns: ["id"]
          },
        ]
      }
      stuecke: {
        Row: {
          erstellt_am: string | null
          erstellt_von: string | null
          id: string
          komponist: string | null
          liedtext: string | null
          notizen: string | null
          schule_id: string
          tempo: string | null
          titel: string
          tonart: string | null
          youtube_url: string | null
        }
        Insert: {
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          komponist?: string | null
          liedtext?: string | null
          notizen?: string | null
          schule_id?: string
          tempo?: string | null
          titel: string
          tonart?: string | null
          youtube_url?: string | null
        }
        Update: {
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          komponist?: string | null
          liedtext?: string | null
          notizen?: string | null
          schule_id?: string
          tempo?: string | null
          titel?: string
          tonart?: string | null
          youtube_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stuecke_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stuecke_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stuecke_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      stunden: {
        Row: {
          absage_grund: string | null
          beginn: string
          ende: string
          erstellt_am: string | null
          hausaufgaben: string | null
          id: string
          notizen: string | null
          raum_id: string | null
          status: Database["public"]["Enums"]["termin_status"] | null
          unterricht_id: string
        }
        Insert: {
          absage_grund?: string | null
          beginn: string
          ende: string
          erstellt_am?: string | null
          hausaufgaben?: string | null
          id?: string
          notizen?: string | null
          raum_id?: string | null
          status?: Database["public"]["Enums"]["termin_status"] | null
          unterricht_id: string
        }
        Update: {
          absage_grund?: string | null
          beginn?: string
          ende?: string
          erstellt_am?: string | null
          hausaufgaben?: string | null
          id?: string
          notizen?: string | null
          raum_id?: string | null
          status?: Database["public"]["Enums"]["termin_status"] | null
          unterricht_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stunden_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raeume"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stunden_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      stunden_lehrer: {
        Row: {
          lehrer_id: string
          rolle: Database["public"]["Enums"]["lehrer_rolle_typ"] | null
          stunde_id: string
        }
        Insert: {
          lehrer_id: string
          rolle?: Database["public"]["Enums"]["lehrer_rolle_typ"] | null
          stunde_id: string
        }
        Update: {
          lehrer_id?: string
          rolle?: Database["public"]["Enums"]["lehrer_rolle_typ"] | null
          stunde_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stunden_lehrer_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stunden_lehrer_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stunden_lehrer_stunde_id_fkey"
            columns: ["stunde_id"]
            isOneToOne: false
            referencedRelation: "stunden"
            referencedColumns: ["id"]
          },
        ]
      }
      unterricht: {
        Row: {
          abrechnungs_typ: Database["public"]["Enums"]["abrechnungs_typ"] | null
          aktiv: boolean | null
          erstellt_am: string | null
          farbe: string | null
          id: string
          instrument_id: string | null
          name: string
          notizen: string | null
          paket_stunden: number | null
          pauschale_monat: number | null
          preis_pro_stunde: number | null
          raum_id: string | null
          schule_id: string
          typ: Database["public"]["Enums"]["unterricht_typ"]
          uhrzeit_bis: string | null
          uhrzeit_von: string | null
          wochentag: Database["public"]["Enums"]["wochentag"] | null
        }
        Insert: {
          abrechnungs_typ?:
            | Database["public"]["Enums"]["abrechnungs_typ"]
            | null
          aktiv?: boolean | null
          erstellt_am?: string | null
          farbe?: string | null
          id?: string
          instrument_id?: string | null
          name: string
          notizen?: string | null
          paket_stunden?: number | null
          pauschale_monat?: number | null
          preis_pro_stunde?: number | null
          raum_id?: string | null
          schule_id?: string
          typ?: Database["public"]["Enums"]["unterricht_typ"]
          uhrzeit_bis?: string | null
          uhrzeit_von?: string | null
          wochentag?: Database["public"]["Enums"]["wochentag"] | null
        }
        Update: {
          abrechnungs_typ?:
            | Database["public"]["Enums"]["abrechnungs_typ"]
            | null
          aktiv?: boolean | null
          erstellt_am?: string | null
          farbe?: string | null
          id?: string
          instrument_id?: string | null
          name?: string
          notizen?: string | null
          paket_stunden?: number | null
          pauschale_monat?: number | null
          preis_pro_stunde?: number | null
          raum_id?: string | null
          schule_id?: string
          typ?: Database["public"]["Enums"]["unterricht_typ"]
          uhrzeit_bis?: string | null
          uhrzeit_von?: string | null
          wochentag?: Database["public"]["Enums"]["wochentag"] | null
        }
        Relationships: [
          {
            foreignKeyName: "unterricht_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instrumente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_raum_id_fkey"
            columns: ["raum_id"]
            isOneToOne: false
            referencedRelation: "raeume"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      unterricht_lehrer: {
        Row: {
          lehrer_id: string
          rolle: Database["public"]["Enums"]["lehrer_rolle_typ"] | null
          seit: string | null
          unterricht_id: string
        }
        Insert: {
          lehrer_id: string
          rolle?: Database["public"]["Enums"]["lehrer_rolle_typ"] | null
          seit?: string | null
          unterricht_id: string
        }
        Update: {
          lehrer_id?: string
          rolle?: Database["public"]["Enums"]["lehrer_rolle_typ"] | null
          seit?: string | null
          unterricht_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unterricht_lehrer_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_lehrer_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_lehrer_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      unterricht_schueler: {
        Row: {
          ausgetreten_am: string | null
          eingetreten_am: string | null
          notizen: string | null
          schueler_id: string
          status: Database["public"]["Enums"]["schueler_status"] | null
          stimmgruppe: Database["public"]["Enums"]["stimmgruppe_typ"] | null
          unterricht_id: string
        }
        Insert: {
          ausgetreten_am?: string | null
          eingetreten_am?: string | null
          notizen?: string | null
          schueler_id: string
          status?: Database["public"]["Enums"]["schueler_status"] | null
          stimmgruppe?: Database["public"]["Enums"]["stimmgruppe_typ"] | null
          unterricht_id: string
        }
        Update: {
          ausgetreten_am?: string | null
          eingetreten_am?: string | null
          notizen?: string | null
          schueler_id?: string
          status?: Database["public"]["Enums"]["schueler_status"] | null
          stimmgruppe?: Database["public"]["Enums"]["stimmgruppe_typ"] | null
          unterricht_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unterricht_schueler_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_schueler_schueler_id_fkey"
            columns: ["schueler_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_schueler_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      unterricht_sessions: {
        Row: {
          aktuelle_ansicht:
            | Database["public"]["Enums"]["praesentation_typ"]
            | null
          aktuelle_datei: string | null
          aktuelles_stueck: string | null
          beendet_am: string | null
          gestartet_am: string | null
          id: string
          join_code: string
          lehrer_id: string
          schule_id: string
          scroll_position: number | null
          status: Database["public"]["Enums"]["session_status"] | null
          stunde_id: string | null
          unterricht_id: string
          youtube_timestamp: number | null
        }
        Insert: {
          aktuelle_ansicht?:
            | Database["public"]["Enums"]["praesentation_typ"]
            | null
          aktuelle_datei?: string | null
          aktuelles_stueck?: string | null
          beendet_am?: string | null
          gestartet_am?: string | null
          id?: string
          join_code?: string
          lehrer_id: string
          schule_id?: string
          scroll_position?: number | null
          status?: Database["public"]["Enums"]["session_status"] | null
          stunde_id?: string | null
          unterricht_id: string
          youtube_timestamp?: number | null
        }
        Update: {
          aktuelle_ansicht?:
            | Database["public"]["Enums"]["praesentation_typ"]
            | null
          aktuelle_datei?: string | null
          aktuelles_stueck?: string | null
          beendet_am?: string | null
          gestartet_am?: string | null
          id?: string
          join_code?: string
          lehrer_id?: string
          schule_id?: string
          scroll_position?: number | null
          status?: Database["public"]["Enums"]["session_status"] | null
          stunde_id?: string | null
          unterricht_id?: string
          youtube_timestamp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "unterricht_sessions_aktuelle_datei_fkey"
            columns: ["aktuelle_datei"]
            isOneToOne: false
            referencedRelation: "stueck_dateien"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_sessions_aktuelles_stueck_fkey"
            columns: ["aktuelles_stueck"]
            isOneToOne: false
            referencedRelation: "stuecke"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_sessions_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_sessions_lehrer_id_fkey"
            columns: ["lehrer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_sessions_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_sessions_stunde_id_fkey"
            columns: ["stunde_id"]
            isOneToOne: false
            referencedRelation: "stunden"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_sessions_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      unterricht_stuecke: {
        Row: {
          reihenfolge: number | null
          status: string | null
          stueck_id: string
          unterricht_id: string
        }
        Insert: {
          reihenfolge?: number | null
          status?: string | null
          stueck_id: string
          unterricht_id: string
        }
        Update: {
          reihenfolge?: number | null
          status?: string | null
          stueck_id?: string
          unterricht_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unterricht_stuecke_stueck_id_fkey"
            columns: ["stueck_id"]
            isOneToOne: false
            referencedRelation: "stuecke"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unterricht_stuecke_unterricht_id_fkey"
            columns: ["unterricht_id"]
            isOneToOne: false
            referencedRelation: "unterricht"
            referencedColumns: ["id"]
          },
        ]
      }
      vorstand_aufgaben: {
        Row: {
          beschreibung: string | null
          erstellt_am: string | null
          erstellt_von: string | null
          faellig_am: string | null
          id: string
          schule_id: string
          status: string | null
          titel: string
          verantwortlicher_id: string | null
          ziel_id: string | null
        }
        Insert: {
          beschreibung?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          faellig_am?: string | null
          id?: string
          schule_id: string
          status?: string | null
          titel: string
          verantwortlicher_id?: string | null
          ziel_id?: string | null
        }
        Update: {
          beschreibung?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          faellig_am?: string | null
          id?: string
          schule_id?: string
          status?: string | null
          titel?: string
          verantwortlicher_id?: string | null
          ziel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vorstand_aufgaben_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_aufgaben_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_aufgaben_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_aufgaben_verantwortlicher_id_fkey"
            columns: ["verantwortlicher_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_aufgaben_verantwortlicher_id_fkey"
            columns: ["verantwortlicher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_aufgaben_ziel_id_fkey"
            columns: ["ziel_id"]
            isOneToOne: false
            referencedRelation: "vorstand_ziele"
            referencedColumns: ["id"]
          },
        ]
      }
      vorstand_protokoll_dateien: {
        Row: {
          bucket_pfad: string
          erstellt_am: string | null
          erstellt_von: string | null
          id: string
          name: string
          protokoll_id: string
          schule_id: string
        }
        Insert: {
          bucket_pfad: string
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          name: string
          protokoll_id: string
          schule_id: string
        }
        Update: {
          bucket_pfad?: string
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          name?: string
          protokoll_id?: string
          schule_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vorstand_protokoll_dateien_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_protokoll_dateien_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_protokoll_dateien_protokoll_id_fkey"
            columns: ["protokoll_id"]
            isOneToOne: false
            referencedRelation: "vorstand_protokolle"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_protokoll_dateien_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      vorstand_protokolle: {
        Row: {
          beschluesse: string | null
          datum: string
          erstellt_am: string | null
          erstellt_von: string | null
          event_id: string | null
          id: string
          inhalt: string | null
          schule_id: string
          sitzungstyp: string | null
          teilnehmer_ids: string[] | null
          titel: string
        }
        Insert: {
          beschluesse?: string | null
          datum: string
          erstellt_am?: string | null
          erstellt_von?: string | null
          event_id?: string | null
          id?: string
          inhalt?: string | null
          schule_id: string
          sitzungstyp?: string | null
          teilnehmer_ids?: string[] | null
          titel: string
        }
        Update: {
          beschluesse?: string | null
          datum?: string
          erstellt_am?: string | null
          erstellt_von?: string | null
          event_id?: string | null
          id?: string
          inhalt?: string | null
          schule_id?: string
          sitzungstyp?: string | null
          teilnehmer_ids?: string[] | null
          titel?: string
        }
        Relationships: [
          {
            foreignKeyName: "vorstand_protokolle_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_protokolle_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_protokolle_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_protokolle_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
      vorstand_ziele: {
        Row: {
          beschreibung: string | null
          erstellt_am: string | null
          erstellt_von: string | null
          id: string
          schule_id: string
          status: string | null
          titel: string
          verantwortlicher_id: string | null
          zeitraum_typ: string | null
          zeitraum_wert: string | null
        }
        Insert: {
          beschreibung?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          schule_id: string
          status?: string | null
          titel: string
          verantwortlicher_id?: string | null
          zeitraum_typ?: string | null
          zeitraum_wert?: string | null
        }
        Update: {
          beschreibung?: string | null
          erstellt_am?: string | null
          erstellt_von?: string | null
          id?: string
          schule_id?: string
          status?: string | null
          titel?: string
          verantwortlicher_id?: string | null
          zeitraum_typ?: string | null
          zeitraum_wert?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vorstand_ziele_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_ziele_erstellt_von_fkey"
            columns: ["erstellt_von"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_ziele_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_ziele_verantwortlicher_id_fkey"
            columns: ["verantwortlicher_id"]
            isOneToOne: false
            referencedRelation: "mitglieder_mit_email"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vorstand_ziele_verantwortlicher_id_fkey"
            columns: ["verantwortlicher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mitglieder_mit_email: {
        Row: {
          adresse: string | null
          aktiv: boolean | null
          aktualisiert_am: string | null
          avatar_url: string | null
          email: string | null
          erstellt_am: string | null
          geburtsdatum: string | null
          id: string | null
          notizen: string | null
          rolle: Database["public"]["Enums"]["user_rolle"] | null
          schule_id: string | null
          sprache: Database["public"]["Enums"]["sprache"] | null
          telefon: string | null
          voller_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_schule_id_fkey"
            columns: ["schule_id"]
            isOneToOne: false
            referencedRelation: "schulen"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_set_email: {
        Args: { p_email: string; p_user_id: string }
        Returns: undefined
      }
      admin_set_password: {
        Args: { p_passwort: string; p_user_id: string }
        Returns: undefined
      }
      anwesenheit_erfassen: {
        Args: { p_schueler: Json; p_stunde_id: string }
        Returns: undefined
      }
      create_unterricht: {
        Args: {
          p_abrechnungs_typ?: Database["public"]["Enums"]["abrechnungs_typ"]
          p_instrument_id: string
          p_lehrer_ids: string[]
          p_name: string
          p_preis?: number
          p_raum_id?: string
          p_schule_id?: string
          p_typ: Database["public"]["Enums"]["unterricht_typ"]
          p_uhrzeit_bis?: string
          p_uhrzeit_von?: string
          p_wochentag?: Database["public"]["Enums"]["wochentag"]
        }
        Returns: string
      }
      create_user: {
        Args: {
          p_email: string
          p_passwort: string
          p_rolle: Database["public"]["Enums"]["user_rolle"]
          p_schule_id?: string
          p_voller_name: string
        }
        Returns: string
      }
      dashboard_stats: { Args: { p_schule_id?: string }; Returns: Json }
      delete_auth_user: { Args: { p_user_id: string }; Returns: undefined }
      get_or_create_kalender_token: { Args: never; Returns: string }
      ist_elternteil_von: { Args: { p_schueler_id: string }; Returns: boolean }
      ist_lehrer_von_schueler: {
        Args: { p_schueler_id: string }
        Returns: boolean
      }
      ist_lehrer_von_unterricht: {
        Args: { p_unterricht_id: string }
        Returns: boolean
      }
      mein_stundenplan: {
        Args: { p_bis?: string; p_von?: string }
        Returns: {
          beginn: string
          ende: string
          hausaufgaben: string
          instrument_icon: string
          lehrer_namen: string[]
          raum_name: string
          status: Database["public"]["Enums"]["termin_status"]
          stunde_id: string
          typ: Database["public"]["Enums"]["unterricht_typ"]
          unterricht_id: string
          unterricht_name: string
        }[]
      }
      meine_rolle: {
        Args: never
        Returns: Database["public"]["Enums"]["user_rolle"]
      }
      meine_schule: { Args: never; Returns: string }
      meine_schule_id: { Args: never; Returns: string }
      paket_stunde_verbrauchen: {
        Args: { p_schueler_id: string; p_unterricht_id: string }
        Returns: boolean
      }
      raum_belegung: {
        Args: { p_bis?: string; p_raum_id: string; p_von?: string }
        Returns: {
          beginn: string
          ende: string
          lehrer_namen: string[]
          stunde_id: string
          unterricht_name: string
        }[]
      }
      session_beenden: {
        Args: { p_anwesenheit?: Json; p_session_id: string }
        Returns: undefined
      }
      session_beitreten: { Args: { p_join_code: string }; Returns: string }
      session_praesentation_wechseln: {
        Args: {
          p_ansicht: Database["public"]["Enums"]["praesentation_typ"]
          p_datei_id?: string
          p_scroll_position?: number
          p_session_id: string
          p_stueck_id?: string
          p_youtube_ts?: number
        }
        Returns: undefined
      }
      session_starten: {
        Args: { p_stunde_id?: string; p_unterricht_id: string }
        Returns: {
          join_code: string
          session_id: string
        }[]
      }
      stunden_generieren: {
        Args: { p_bis: string; p_unterricht_id: string; p_von: string }
        Returns: number
      }
    }
    Enums: {
      abrechnungs_typ: "einzeln" | "paket" | "pauschale"
      anwesenheit_status: "anwesend" | "abwesend" | "entschuldigt" | "zu_spaet"
      datei_typ:
        | "noten"
        | "akkorde"
        | "audio"
        | "video"
        | "dokument"
        | "sonstiges"
      event_typ:
        | "konzert"
        | "vorspiel"
        | "pruefung"
        | "veranstaltung"
        | "sonstiges"
        | "vorstandssitzung"
      lehrer_rolle_typ: "hauptlehrer" | "co_lehrer" | "vertretung"
      lernfortschritt:
        | "sehr_gut"
        | "gut"
        | "befriedigend"
        | "ausreichend"
        | "mangelhaft"
      nachricht_typ: "broadcast" | "direkt"
      praesentation_typ:
        | "noten"
        | "liedtext"
        | "akkorde"
        | "youtube"
        | "dateiverwaltung"
      reaktion_typ:
        | "daumen_hoch"
        | "daumen_runter"
        | "hand_hoch"
        | "herz"
        | "verwirrung"
      schueler_status:
        | "interessent"
        | "probe"
        | "aktiv"
        | "pausiert"
        | "abgemeldet"
      session_status: "wartend" | "aktiv" | "beendet"
      sprache: "de" | "en" | "tr"
      stimmgruppe_typ: "sopran" | "alt" | "tenor" | "bass" | "keine"
      termin_status: "geplant" | "stattgefunden" | "abgesagt" | "verschoben"
      unterricht_typ: "einzel" | "gruppe" | "chor" | "ensemble"
      user_rolle:
        | "superadmin"
        | "admin"
        | "lehrer"
        | "schueler"
        | "eltern"
        | "vorstand"
      wochentag: "mo" | "di" | "mi" | "do" | "fr" | "sa" | "so"
      zusage_status: "offen" | "zugesagt" | "abgesagt"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      abrechnungs_typ: ["einzeln", "paket", "pauschale"],
      anwesenheit_status: ["anwesend", "abwesend", "entschuldigt", "zu_spaet"],
      datei_typ: [
        "noten",
        "akkorde",
        "audio",
        "video",
        "dokument",
        "sonstiges",
      ],
      event_typ: [
        "konzert",
        "vorspiel",
        "pruefung",
        "veranstaltung",
        "sonstiges",
        "vorstandssitzung",
      ],
      lehrer_rolle_typ: ["hauptlehrer", "co_lehrer", "vertretung"],
      lernfortschritt: [
        "sehr_gut",
        "gut",
        "befriedigend",
        "ausreichend",
        "mangelhaft",
      ],
      nachricht_typ: ["broadcast", "direkt"],
      praesentation_typ: [
        "noten",
        "liedtext",
        "akkorde",
        "youtube",
        "dateiverwaltung",
      ],
      reaktion_typ: [
        "daumen_hoch",
        "daumen_runter",
        "hand_hoch",
        "herz",
        "verwirrung",
      ],
      schueler_status: [
        "interessent",
        "probe",
        "aktiv",
        "pausiert",
        "abgemeldet",
      ],
      session_status: ["wartend", "aktiv", "beendet"],
      sprache: ["de", "en", "tr"],
      stimmgruppe_typ: ["sopran", "alt", "tenor", "bass", "keine"],
      termin_status: ["geplant", "stattgefunden", "abgesagt", "verschoben"],
      unterricht_typ: ["einzel", "gruppe", "chor", "ensemble"],
      user_rolle: [
        "superadmin",
        "admin",
        "lehrer",
        "schueler",
        "eltern",
        "vorstand",
      ],
      wochentag: ["mo", "di", "mi", "do", "fr", "sa", "so"],
      zusage_status: ["offen", "zugesagt", "abgesagt"],
    },
  },
} as const

A new version of Supabase CLI is available: v2.95.4 (currently installed v2.90.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
