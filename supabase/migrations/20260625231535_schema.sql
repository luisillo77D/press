-- Enable UUID generation extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Custom Types and Enums
CREATE TYPE public.user_role AS ENUM ('owner', 'administrator', 'collector');
CREATE TYPE public.loan_status AS ENUM ('draft', 'active', 'paid', 'defaulted', 'cancelled');
CREATE TYPE public.installment_status AS ENUM ('pending', 'partially_paid', 'paid', 'late');

-- 2. Table Definitions

-- Tenants Table
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    subdomain TEXT UNIQUE,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    settings JSONB NOT NULL DEFAULT '{
        "interest_rate_default": 20.0,
        "term_weeks_default": 15,
        "is_aval_mandatory": true,
        "penalty_type": "flat",
        "penalty_amount_default": 50.00,
        "grace_period_days": 1
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles Table (Extends Supabase Auth users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE, -- Nullable for Global Admins
    email TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role public.user_role NOT NULL DEFAULT 'collector',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Clients Table
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT NOT NULL,
    ine_front_url TEXT,
    ine_back_url TEXT,
    address_proof_url TEXT,
    qr_code_identifier TEXT, -- Unique per tenant, checked via index
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Loans Table
CREATE TABLE public.loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT NOT NULL,
    aval_id UUID REFERENCES public.clients(id) ON DELETE RESTRICT,
    principal_amount NUMERIC(12,2) NOT NULL,
    interest_amount NUMERIC(12,2) NOT NULL,
    total_to_pay NUMERIC(12,2) NOT NULL,
    term_weeks INT NOT NULL DEFAULT 15,
    status public.loan_status NOT NULL DEFAULT 'draft',
    payment_frequency TEXT NOT NULL DEFAULT 'weekly',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Installments Table
CREATE TABLE public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
    installment_number INT NOT NULL,
    due_date DATE NOT NULL,
    amount_due NUMERIC(12,2) NOT NULL,
    amount_paid NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    fine_amount NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    status public.installment_status NOT NULL DEFAULT 'pending',
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_loan_installment UNIQUE (loan_id, installment_number)
);

-- Payments Table (Transactions ledger)
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    loan_id UUID REFERENCES public.loans(id) ON DELETE CASCADE NOT NULL,
    installment_id UUID REFERENCES public.installments(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    fine_applied NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    fine_condoned NUMERIC(12,2) DEFAULT 0.00 NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    payment_method TEXT DEFAULT 'cash' NOT NULL,
    registered_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NOT NULL,
    notes TEXT
);

-- 3. Indexes for Search and Performance Optimization (supabase-postgres-best-practices)
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
CREATE INDEX idx_clients_tenant ON public.clients(tenant_id);
CREATE UNIQUE INDEX idx_clients_tenant_qr ON public.clients(tenant_id, qr_code_identifier) WHERE qr_code_identifier IS NOT NULL;
CREATE INDEX idx_clients_search ON public.clients(tenant_id, last_name, first_name);
CREATE INDEX idx_loans_tenant_client ON public.loans(tenant_id, client_id);
CREATE INDEX idx_loans_status ON public.loans(tenant_id, status);
CREATE INDEX idx_installments_loan ON public.installments(loan_id);
CREATE INDEX idx_installments_due ON public.installments(tenant_id, due_date, status);
CREATE INDEX idx_payments_installment ON public.payments(installment_id);
CREATE INDEX idx_payments_loan ON public.payments(loan_id);

-- 4. Row Level Security (RLS) Configuration
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Helper RLS helper claims check function
CREATE OR REPLACE FUNCTION public.is_global_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_global_admin')::BOOLEAN, false);
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
$$ LANGUAGE sql SECURITY DEFINER;

-- 4.1 Tenants Policies
CREATE POLICY "Global Admin access all tenants" ON public.tenants
    TO authenticated USING (public.is_global_admin());

CREATE POLICY "Tenant Owner/Admin can view their own tenant" ON public.tenants
    FOR SELECT TO authenticated USING (id = public.current_tenant_id());

CREATE POLICY "Tenant Owner can update settings" ON public.tenants
    FOR UPDATE TO authenticated 
    USING (id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner')
    WITH CHECK (id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') = 'owner');

-- 4.2 Profiles Policies
CREATE POLICY "Global Admin access all profiles" ON public.profiles
    TO authenticated USING (public.is_global_admin());

CREATE POLICY "Users can view profiles within their tenant" ON public.profiles
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Owners and Administrators can manage profiles" ON public.profiles
    FOR ALL TO authenticated 
    USING (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'))
    WITH CHECK (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'));

-- 4.3 Clients Policies
CREATE POLICY "Global Admin access all clients" ON public.clients
    TO authenticated USING (public.is_global_admin());

CREATE POLICY "Tenant members can view clients" ON public.clients
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can insert clients" ON public.clients
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can update clients" ON public.clients
    FOR UPDATE TO authenticated 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Only Tenant Owners and Admins can delete clients" ON public.clients
    FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'));

-- 4.4 Loans Policies
CREATE POLICY "Global Admin access all loans" ON public.loans
    TO authenticated USING (public.is_global_admin());

CREATE POLICY "Tenant members can view loans" ON public.loans
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can insert loans" ON public.loans
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant Owner and Admin can update loans" ON public.loans
    FOR UPDATE TO authenticated 
    USING (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'))
    WITH CHECK (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'));

CREATE POLICY "Only Tenant Owners and Admins can delete loans" ON public.loans
    FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'));

-- 4.5 Installments Policies
CREATE POLICY "Global Admin access all installments" ON public.installments
    TO authenticated USING (public.is_global_admin());

CREATE POLICY "Tenant members can view installments" ON public.installments
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can insert/update installments" ON public.installments
    FOR ALL TO authenticated 
    USING (tenant_id = public.current_tenant_id())
    WITH CHECK (tenant_id = public.current_tenant_id());

-- 4.6 Payments Policies
CREATE POLICY "Global Admin access all payments" ON public.payments
    TO authenticated USING (public.is_global_admin());

CREATE POLICY "Tenant members can view payments" ON public.payments
    FOR SELECT TO authenticated USING (tenant_id = public.current_tenant_id());

CREATE POLICY "Tenant members can insert payments" ON public.payments
    FOR INSERT TO authenticated WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "Only Tenant Owners and Admins can delete/update payments" ON public.payments
    FOR DELETE TO authenticated USING (tenant_id = public.current_tenant_id() AND (auth.jwt() -> 'app_metadata' ->> 'role') IN ('owner', 'administrator'));

-- 5. Automatic Auth-to-Profile Sync Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_tenant_id UUID;
    v_role TEXT;
    v_full_name TEXT;
    v_tenant_name TEXT;
BEGIN
    -- Extract values from user_metadata
    v_tenant_id := (new.raw_user_meta_data ->> 'tenant_id')::UUID;
    v_role := COALESCE(new.raw_user_meta_data ->> 'role', 'collector');
    v_full_name := COALESCE(new.raw_user_meta_data ->> 'full_name', 'Nuevo Usuario');
    v_tenant_name := new.raw_user_meta_data ->> 'tenant_name';

    -- SECURITY SAFEGUARDS:
    -- 1. Force is_global_admin to false on all signups. Superadmins must be promoted manually via SQL.
    -- 2. If a user signs up without a tenant_id, they are creating a new tenant business and become the owner.
    -- 3. Force role to 'owner' for new tenant signups.
    IF v_tenant_id IS NULL THEN
        INSERT INTO public.tenants (name)
        VALUES (COALESCE(v_tenant_name, 'Mi Negocio de Préstamos'))
        RETURNING id INTO v_tenant_id;
        v_role := 'owner'; -- First user is always owner
    END IF;

    -- Insert profile entry
    INSERT INTO public.profiles (id, tenant_id, email, full_name, role)
    VALUES (new.id, v_tenant_id, new.email, v_full_name, v_role::public.user_role);

    -- Set app_metadata claims in Auth table (force is_global_admin = false)
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || 
        jsonb_build_object(
            'tenant_id', v_tenant_id,
            'role', v_role,
            'is_global_admin', false
        )
    WHERE id = new.id;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RPC Database Functions

-- 6.1 RPC: Create Loan and Amortization Installments in a single transaction
CREATE OR REPLACE FUNCTION public.create_loan_with_installments(
    p_client_id UUID,
    p_aval_id UUID,
    p_principal_amount NUMERIC,
    p_interest_amount NUMERIC,
    p_total_to_pay NUMERIC,
    p_term_weeks INT,
    p_payment_frequency TEXT,
    p_start_date DATE
)
RETURNS UUID AS $$
DECLARE
    v_loan_id UUID;
    v_tenant_id UUID;
    v_profile_id UUID;
    v_installment_amount NUMERIC;
    v_due_date DATE;
    i INT;
BEGIN
    v_tenant_id := public.current_tenant_id();
    v_profile_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant ID found in user session';
    END IF;

    -- Insert the loan record
    INSERT INTO public.loans (
        tenant_id, client_id, aval_id, principal_amount, interest_amount, 
        total_to_pay, term_weeks, payment_frequency, start_date, 
        end_date, status, created_by
    )
    VALUES (
        v_tenant_id, p_client_id, p_aval_id, p_principal_amount, p_interest_amount,
        p_total_to_pay, p_term_weeks, p_payment_frequency, p_start_date,
        p_start_date + (p_term_weeks * 7), 'active', v_profile_id
    )
    RETURNING id INTO v_loan_id;

    -- Base weekly calculation
    v_installment_amount := TRUNC(p_total_to_pay / p_term_weeks, 2);

    -- Loop to insert each installment
    FOR i IN 1..p_term_weeks LOOP
        v_due_date := p_start_date + (i * 7);
        
        -- Rounding adjustment on last installment
        IF i = p_term_weeks THEN
            v_installment_amount := p_total_to_pay - (v_installment_amount * (p_term_weeks - 1));
        END IF;

        INSERT INTO public.installments (
            tenant_id, loan_id, installment_number, due_date, amount_due, amount_paid, status
        )
        VALUES (
            v_tenant_id, v_loan_id, i, v_due_date, v_installment_amount, 0.00, 'pending'
        );
    END LOOP;

    RETURN v_loan_id;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 6.2 RPC: Register Payment chronologically (Ultra-Fast Collection core)
CREATE OR REPLACE FUNCTION public.register_payment(
    p_loan_id UUID,
    p_amount NUMERIC,
    p_condone_fines BOOLEAN,
    p_payment_method TEXT DEFAULT 'cash',
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_profile_id UUID;
    v_remaining_payment NUMERIC;
    v_inst RECORD;
    v_fine_applied NUMERIC;
    v_fine_condoned NUMERIC;
    v_amount_to_installment NUMERIC;
    v_amount_to_fine NUMERIC;
    v_payment_id UUID;
    v_total_fine_applied NUMERIC := 0.00;
    v_total_fine_condoned NUMERIC := 0.00;
    v_receipts JSONB := '[]'::jsonb;
BEGIN
    v_tenant_id := public.current_tenant_id();
    v_profile_id := auth.uid();

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No tenant ID found in user session';
    END IF;

    v_remaining_payment := p_amount;

    -- Iterate through unpaid installments ordered chronologically
    FOR v_inst IN 
        SELECT id, installment_number, due_date, amount_due, amount_paid, fine_amount, status
        FROM public.installments
        WHERE loan_id = p_loan_id AND status IN ('pending', 'partially_paid', 'late')
        ORDER BY installment_number ASC
    LOOP
        EXIT WHEN v_remaining_payment <= 0 AND NOT p_condone_fines;

        v_fine_applied := 0.00;
        v_fine_condoned := 0.00;
        v_amount_to_fine := 0.00;
        v_amount_to_installment := 0.00;

        -- 1. Apply Fine Condonation
        IF p_condone_fines AND v_inst.fine_amount > 0 THEN
            v_fine_condoned := v_inst.fine_amount;
            v_total_fine_condoned := v_total_fine_condoned + v_fine_condoned;
            
            UPDATE public.installments
            SET fine_amount = 0.00
            WHERE id = v_inst.id;
            
            v_inst.fine_amount := 0.00;
        END IF;

        -- 2. Deduct Fine Amount from Payment
        IF v_inst.fine_amount > 0 AND v_remaining_payment > 0 THEN
            IF v_remaining_payment >= v_inst.fine_amount THEN
                v_amount_to_fine := v_inst.fine_amount;
                v_remaining_payment := v_remaining_payment - v_amount_to_fine;
                v_fine_applied := v_amount_to_fine;
                v_total_fine_applied := v_total_fine_applied + v_fine_applied;
                
                UPDATE public.installments
                SET fine_amount = 0.00
                WHERE id = v_inst.id;
                
                v_inst.fine_amount := 0.00;
            ELSE
                v_amount_to_fine := v_remaining_payment;
                v_remaining_payment := 0.00;
                v_fine_applied := v_amount_to_fine;
                v_total_fine_applied := v_total_fine_applied + v_fine_applied;
                
                UPDATE public.installments
                SET fine_amount = fine_amount - v_amount_to_fine;
                
                v_inst.fine_amount := v_inst.fine_amount - v_amount_to_fine;
            END IF;
        END IF;

        -- 3. Deduct Installment Principal Amount from Payment
        IF v_remaining_payment > 0 THEN
            DECLARE
                v_outstanding NUMERIC;
            BEGIN
                v_outstanding := v_inst.amount_due - v_inst.amount_paid;
                
                IF v_remaining_payment >= v_outstanding THEN
                    v_amount_to_installment := v_outstanding;
                    v_remaining_payment := v_remaining_payment - v_amount_to_installment;
                    
                    UPDATE public.installments
                    SET amount_paid = amount_due,
                        status = 'paid',
                        paid_at = timezone('utc'::text, now())
                    WHERE id = v_inst.id;
                ELSE
                    v_amount_to_installment := v_remaining_payment;
                    v_remaining_payment := 0.00;
                    
                    UPDATE public.installments
                    SET amount_paid = amount_paid + v_amount_to_installment,
                        status = 'partially_paid'
                    WHERE id = v_inst.id;
                END IF;
            END;
        END IF;

        -- 4. Create Ledger Record for the payment transaction
        IF v_amount_to_installment > 0 OR v_fine_applied > 0 OR v_fine_condoned > 0 THEN
            INSERT INTO public.payments (
                tenant_id, loan_id, installment_id, amount, fine_applied, fine_condoned, 
                payment_method, registered_by, notes
            )
            VALUES (
                v_tenant_id, p_loan_id, v_inst.id, v_amount_to_installment + v_fine_applied, 
                v_fine_applied, v_fine_condoned, p_payment_method, v_profile_id, p_notes
            )
            RETURNING id INTO v_payment_id;

            v_receipts := v_receipts || jsonb_build_object(
                'installment_number', v_inst.installment_number,
                'amount_paid', v_amount_to_installment,
                'fine_paid', v_fine_applied,
                'fine_condoned', v_fine_condoned,
                'payment_id', v_payment_id
            );
        END IF;
    END LOOP;

    -- If all installments of the loan are fully paid, mark the loan as paid
    IF NOT EXISTS (
        SELECT 1 FROM public.installments 
        WHERE loan_id = p_loan_id AND status != 'paid'
    ) THEN
        UPDATE public.loans
        SET status = 'paid'
        WHERE id = p_loan_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'loan_id', p_loan_id,
        'change_returned', v_remaining_payment,
        'total_fine_applied', v_total_fine_applied,
        'total_fine_condoned', v_total_fine_condoned,
        'receipts', v_receipts
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

-- 6.3 Database function to scan and apply late fines on overdue installments
CREATE OR REPLACE FUNCTION public.apply_overdue_fines()
RETURNS INT AS $$
DECLARE
    v_updated_count INT := 0;
    v_inst RECORD;
    v_fine_amount NUMERIC;
BEGIN
    FOR v_inst IN 
        SELECT i.id, i.tenant_id, (t.settings->>'penalty_amount_default')::NUMERIC as default_fine
        FROM public.installments i
        JOIN public.tenants t ON i.tenant_id = t.id
        WHERE i.due_date < CURRENT_DATE 
          AND i.status IN ('pending', 'partially_paid')
          AND i.status != 'late'
    LOOP
        v_fine_amount := COALESCE(v_inst.default_fine, 50.00);
        
        UPDATE public.installments
        SET status = 'late',
            fine_amount = v_fine_amount
        WHERE id = v_inst.id;
        
        -- Set loan to defaulted if it is currently active
        UPDATE public.loans l
        SET status = 'defaulted'
        FROM public.installments inst
        WHERE inst.loan_id = l.id AND inst.id = v_inst.id AND l.status = 'active';

        v_updated_count := v_updated_count + 1;
    END LOOP;

    RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
