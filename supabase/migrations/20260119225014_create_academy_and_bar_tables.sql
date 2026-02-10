/*
  # Academy and Bar/Restaurant Tables
  
  This migration adds tables for the Academy (coaching) and Bar/Restaurant modules.
  
  ## 1. Academy Tables
  
  ### Coaches (club_coaches)
  - Links to auth users who are coaches
  - Contains bio, specialties, hourly rate
  
  ### Class Types (class_types)
  - Defines types of classes offered (beginner, advanced, kids, etc.)
  - Duration, max students, pricing
  
  ### Classes (club_classes)
  - Scheduled classes with coach, court, time
  - Links class type to actual scheduled sessions
  
  ### Class Enrollments (class_enrollments)
  - Students enrolled in specific classes
  
  ### Student Packages (student_packages)
  - Credit packages purchased by students
  - Track credits used/remaining
  
  ## 2. Bar/Restaurant Tables
  
  ### Menu Categories (menu_categories)
  - Food/drink categories
  
  ### Menu Items (menu_items)
  - Individual items with prices
  
  ### Orders (bar_orders)
  - Customer orders
  
  ### Order Items (bar_order_items)
  - Items in each order
  
  ## 3. Security
  - RLS enabled on all tables
  - Appropriate policies for each user role
*/

-- =====================
-- ACADEMY TABLES
-- =====================

-- Coaches table
CREATE TABLE IF NOT EXISTS club_coaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bio text,
  specialties text[],
  hourly_rate decimal(10,2) NOT NULL DEFAULT 0,
  phone text,
  email text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE club_coaches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their coaches"
  ON club_coaches
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Anyone can view active coaches"
  ON club_coaches
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Class Types table
CREATE TABLE IF NOT EXISTS class_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 60,
  max_students integer NOT NULL DEFAULT 4,
  price_per_class decimal(10,2) NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE class_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their class types"
  ON class_types
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Anyone can view active class types"
  ON class_types
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Classes table (scheduled sessions)
CREATE TABLE IF NOT EXISTS club_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES club_coaches(id) ON DELETE CASCADE,
  court_id uuid REFERENCES club_courts(id) ON DELETE SET NULL,
  class_type_id uuid NOT NULL REFERENCES class_types(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE club_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their classes"
  ON club_classes
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Anyone can view scheduled classes"
  ON club_classes
  FOR SELECT
  TO authenticated
  USING (status IN ('scheduled', 'in_progress'));

-- Class Enrollments table
CREATE TABLE IF NOT EXISTS class_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES club_classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name text,
  status text NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'attended', 'cancelled', 'no_show')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, student_id)
);

ALTER TABLE class_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage enrollments for their classes"
  ON class_enrollments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM club_classes
      WHERE club_classes.id = class_enrollments.class_id
      AND club_classes.club_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_classes
      WHERE club_classes.id = class_enrollments.class_id
      AND club_classes.club_owner_id = auth.uid()
    )
  );

CREATE POLICY "Students can view their own enrollments"
  ON class_enrollments
  FOR SELECT
  TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students can enroll themselves"
  ON class_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid());

-- Student Packages (credit system)
CREATE TABLE IF NOT EXISTS student_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_type_id uuid NOT NULL REFERENCES class_types(id) ON DELETE CASCADE,
  credits_total integer NOT NULL DEFAULT 0,
  credits_used integer NOT NULL DEFAULT 0,
  amount_paid decimal(10,2) NOT NULL DEFAULT 0,
  expires_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE student_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage packages"
  ON student_packages
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Users can view their own packages"
  ON student_packages
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =====================
-- BAR/RESTAURANT TABLES
-- =====================

-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their menu categories"
  ON menu_categories
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Anyone can view active categories"
  ON menu_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price decimal(10,2) NOT NULL DEFAULT 0,
  is_available boolean NOT NULL DEFAULT true,
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage their menu items"
  ON menu_items
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Anyone can view available items"
  ON menu_items
  FOR SELECT
  TO authenticated
  USING (is_available = true);

-- Bar Orders
CREATE TABLE IF NOT EXISTS bar_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name text,
  table_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  total decimal(10,2) NOT NULL DEFAULT 0,
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bar_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage orders"
  ON bar_orders
  FOR ALL
  TO authenticated
  USING (club_owner_id = auth.uid())
  WITH CHECK (club_owner_id = auth.uid());

CREATE POLICY "Users can view their own orders"
  ON bar_orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create orders"
  ON bar_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- Bar Order Items
CREATE TABLE IF NOT EXISTS bar_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES bar_orders(id) ON DELETE CASCADE,
  menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL DEFAULT 1,
  price decimal(10,2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bar_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club owners can manage order items"
  ON bar_order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bar_orders
      WHERE bar_orders.id = bar_order_items.order_id
      AND bar_orders.club_owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bar_orders
      WHERE bar_orders.id = bar_order_items.order_id
      AND bar_orders.club_owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can view items in their orders"
  ON bar_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bar_orders
      WHERE bar_orders.id = bar_order_items.order_id
      AND bar_orders.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_club_coaches_club_owner_id ON club_coaches(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_class_types_club_owner_id ON class_types(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_club_classes_club_owner_id ON club_classes(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_club_classes_scheduled_at ON club_classes(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_club_classes_coach_id ON club_classes(coach_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_class_id ON class_enrollments(class_id);
CREATE INDEX IF NOT EXISTS idx_class_enrollments_student_id ON class_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_packages_user_id ON student_packages(user_id);
CREATE INDEX IF NOT EXISTS idx_menu_categories_club_owner_id ON menu_categories(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX IF NOT EXISTS idx_bar_orders_club_owner_id ON bar_orders(club_owner_id);
CREATE INDEX IF NOT EXISTS idx_bar_orders_status ON bar_orders(status);
CREATE INDEX IF NOT EXISTS idx_bar_order_items_order_id ON bar_order_items(order_id);
