import { useState, useEffect } from "react";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { User } from "../types";

export function useAuth() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch user profile from our users table
  const fetchUserProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user profile:", error);
      return;
    }

    if (data) {
      setUserProfile(data);
    }
  };

  // Check current session and listen for auth changes
  useEffect(() => {
    const getInitialSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserProfile(session.user.id);
      }

      setLoading(false);
    };

    getInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchUserProfile(session.user.id);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // SIGN UP
//   const signUp = async (
//   email: string,
//   password: string,
//   username?: string
// ) => {
//   const { data, error } = await supabase.auth.signUp({
//     email,
//     password,
//     options: {
//       data: {
//         username: username || null,
//       },
//     },
//   });

//   if (error) {
//     console.error("Signup error:", error);
//   } else {
//     console.log("Signup response:", data);
//   }

//   return { data, error };
// };

const signUp = async (
  email: string,
  password: string,
  username?: string
) => {
  console.log("Starting signup...");
  console.log("Email:", email);
  console.log("Username:", username);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username: username || null,
      },
    },
  });

  console.log("SIGNUP DATA:", data);
  console.log("SIGNUP ERROR:", error);

  return { data, error };
};

  // SIGN IN
  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login error:", error);
    } else {
      console.log("Login successful:", data);
    }

    return { data, error };
  };

  // SIGN OUT
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
    }

    setUser(null);
    setUserProfile(null);

    return { error };
  };

  // UPDATE PROFILE
  const updateProfile = async (updates: { username?: string }) => {
    if (!user) {
      throw new Error("No user logged in");
    }

    const { data, error } = await supabase
      .from("users")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Profile update error:", error);
    } else if (data) {
      setUserProfile(data);
    }

    return { data, error };
  };

  return {
    user,
    userProfile,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  };
}