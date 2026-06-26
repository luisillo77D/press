-- Create bucket for client documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
    'client-documents', 
    'client-documents', 
    false, 
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Policies for storage.objects
-- Allow authenticated users to manage files belonging to their tenant
-- Path format: [tenant_id]/[client_id]/[filename]

CREATE POLICY "Tenant isolation for storage uploads" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_global_admin() OR 
        (split_part(name, '/', 1))::UUID = public.current_tenant_id()
    );

CREATE POLICY "Tenant isolation for storage views" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        public.is_global_admin() OR 
        (split_part(name, '/', 1))::UUID = public.current_tenant_id()
    );

CREATE POLICY "Tenant isolation for storage updates" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        public.is_global_admin() OR 
        (split_part(name, '/', 1))::UUID = public.current_tenant_id()
    )
    WITH CHECK (
        public.is_global_admin() OR 
        (split_part(name, '/', 1))::UUID = public.current_tenant_id()
    );

CREATE POLICY "Tenant isolation for storage deletions" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        public.is_global_admin() OR 
        (split_part(name, '/', 1))::UUID = public.current_tenant_id()
    );
