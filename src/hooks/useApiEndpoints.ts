import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { ApiEndpoint, ApiCheck } from "../types";
import { useAuth } from "./useAuth";

export function useApiEndpoints() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();

  // -----------------------------------------
  // FETCH ENDPOINTS
  // -----------------------------------------
  const fetchEndpoints = useCallback(async () => {
    if (!user) {
      setEndpoints([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from("api_endpoints")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setEndpoints(data || []);
    } catch (err) {
      console.error("Failed to fetch endpoints:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Failed to fetch API endpoints"
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  // -----------------------------------------
  // ADD ENDPOINT
  // -----------------------------------------
  const addEndpoint = async (
    endpoint: Omit<
      ApiEndpoint,
      | "id"
      | "user_id"
      | "created_at"
      | "updated_at"
      | "status"
      | "last_checked"
    >
  ) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      setError(null);

      const { data, error } = await supabase
        .from("api_endpoints")
        .insert([
          {
            ...endpoint,
            user_id: user.id,
            status: "unknown",
          },
        ])
        .select()
        .single();

      if (error) {
        throw error;
      }

      setEndpoints((prev) => [data, ...prev]);

      return data;
    } catch (err) {
      console.error("Failed to add endpoint:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Failed to add API endpoint";

      setError(message);
      throw err;
    }
  };

  // -----------------------------------------
  // UPDATE ENDPOINT
  // -----------------------------------------
  const updateEndpoint = async (
    id: string,
    updates: Partial<ApiEndpoint>
  ) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      setError(null);

      const { data, error } = await supabase
        .from("api_endpoints")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setEndpoints((prev) =>
        prev.map((endpoint) =>
          endpoint.id === id ? data : endpoint
        )
      );

      return data;
    } catch (err) {
      console.error("Failed to update endpoint:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Failed to update API endpoint";

      setError(message);
      throw err;
    }
  };

  // -----------------------------------------
  // DELETE ENDPOINT
  // -----------------------------------------
  const deleteEndpoint = async (id: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      setError(null);

      const { error } = await supabase
        .from("api_endpoints")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) {
        throw error;
      }

      setEndpoints((prev) =>
        prev.filter((endpoint) => endpoint.id !== id)
      );
    } catch (err) {
      console.error("Failed to delete endpoint:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Failed to delete API endpoint";

      setError(message);
      throw err;
    }
  };

  // -----------------------------------------
  // MANUAL API CHECK
  // -----------------------------------------
  const triggerManualCheck = async (endpointId: string) => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    try {
      setError(null);

      // Get the endpoint
      const { data: endpoint, error: fetchError } = await supabase
        .from("api_endpoints")
        .select("*")
        .eq("id", endpointId)
        .eq("user_id", user.id)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      if (!endpoint) {
        throw new Error("Endpoint not found");
      }

      const startTime = Date.now();

      let checkResult: {
        endpoint_id: string;
        status: "up" | "down";
        response_time: number;
        status_code?: number;
        error_message?: string | null;
      };

      try {
        const response = await fetch(endpoint.url, {
          method: "GET",
          headers: {
            "User-Agent": "ATINAR-Monitor/1.0",
          },
          signal: AbortSignal.timeout(10000),
        });

        const responseTime = Date.now() - startTime;

        checkResult = {
          endpoint_id: endpointId,
          status: response.ok ? "up" : "down",
          response_time: responseTime,
          status_code: response.status,
          error_message: response.ok
            ? null
            : `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch (err) {
        const responseTime = Date.now() - startTime;

        checkResult = {
          endpoint_id: endpointId,
          status: "down",
          response_time: responseTime,
          error_message:
            err instanceof Error
              ? err.message
              : "Connection failed",
        };
      }

      // Store check result
      const { error: insertError } = await supabase
        .from("api_checks")
        .insert([checkResult]);

      if (insertError) {
        throw insertError;
      }

      // Update endpoint status
      const { error: updateError } = await supabase
        .from("api_endpoints")
        .update({
          status: checkResult.status,
          last_checked: new Date().toISOString(),
        })
        .eq("id", endpointId)
        .eq("user_id", user.id);

      if (updateError) {
        throw updateError;
      }

      // Refresh the endpoint list
      await fetchEndpoints();

      return checkResult;
    } catch (err) {
      console.error("Manual check failed:", err);

      const message =
        err instanceof Error
          ? err.message
          : "Manual API check failed";

      setError(message);
      throw err;
    }
  };

  // -----------------------------------------
  // GET CHECK HISTORY
  // -----------------------------------------
  const getEndpointChecks = async (
    endpointId: string,
    limit = 50
  ): Promise<ApiCheck[]> => {
    if (!user) {
      throw new Error("User not authenticated");
    }

    const { data, error } = await supabase
      .from("api_checks")
      .select(`
        *
      `)
      .eq("endpoint_id", endpointId)
      .order("checked_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data || [];
  };

  // -----------------------------------------
  // INITIAL FETCH
  // -----------------------------------------

  const getAllChecks = async (): Promise<ApiCheck[]> => {
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('api_checks')
    .select(`
      *,
      api_endpoints!inner(user_id)
    `)
    .eq('api_endpoints.user_id', user.id)
    .order('checked_at', { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
};

  useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  return {
    endpoints,
    loading,
    error,

    addEndpoint,
    updateEndpoint,
    deleteEndpoint,

    triggerManualCheck,
    getEndpointChecks,
    getAllChecks,

    refetch: fetchEndpoints,
  };
}