BEGIN;

-- CreateTable
CREATE TABLE "ingredients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "stock" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ingredients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recipe_ingredients" (
    "product_id" TEXT NOT NULL,
    "size" VARCHAR(5) NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "recipe_ingredients_pkey" PRIMARY KEY ("product_id","size","ingredient_id")
);

-- CreateTable
CREATE TABLE "order_ingredients" (
    "order_id" TEXT NOT NULL,
    "ingredient_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "order_ingredients_pkey" PRIMARY KEY ("order_id","ingredient_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ingredients_name_key" ON "ingredients"("name");

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_ingredients" ADD CONSTRAINT "order_ingredients_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_ingredients" ADD CONSTRAINT "order_ingredients_ingredient_id_fkey" FOREIGN KEY ("ingredient_id") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ingredients" ADD CONSTRAINT "ingredients_stock_nonnegative" CHECK ("stock" >= 0);
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_size_valid" CHECK ("size" IN ('S', 'M', 'L'));
ALTER TABLE "order_ingredients" ADD CONSTRAINT "consumption_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "orders" ADD COLUMN "points_redeemed" INTEGER NOT NULL DEFAULT 0;

COMMIT;
