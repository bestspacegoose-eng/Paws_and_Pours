import { recipeById, type Order } from "../shared/game";
import { drawRecipeDrink } from "./drink-art";
import { drawIngredientIcon } from "./tavern-renderer";

export class OrderHud {
  private signature = "";
  constructor(private readonly root: HTMLElement, private readonly ingredients: HTMLImageElement) {
    ingredients.addEventListener("load", () => { this.signature = ""; });
  }
  render(orders: Order[]) {
    const signature = orders.map((order) => `${order.id}:${order.recipeId}`).join("|");
    if (signature !== this.signature || !this.root.childElementCount) {
      this.signature = signature;
      this.root.replaceChildren();
      for (const order of orders) {
        const recipe = recipeById(order.recipeId);
        const card = document.createElement("article"); card.className = "order-ticket";
        const title = document.createElement("strong"); title.textContent = recipe.name;
        const art = document.createElement("canvas"); art.width = 216; art.height = 52;
        art.setAttribute("role", "img"); art.setAttribute("aria-label", `${recipe.name}: ${recipe.ingredients.join(", ")}`);
        const context = art.getContext("2d")!; context.imageSmoothingEnabled = false;
        drawRecipeDrink(context, recipe, 25, 25, 47);
        recipe.ingredients.forEach((ingredient, index) => {
          const x = 84 + index * 47;
          context.fillStyle = "#f1dfbf"; context.fillRect(x - 19, 5, 38, 39);
          drawIngredientIcon(context, this.ingredients, ingredient, x, 24, 31);
        });
        const progress = document.createElement("progress"); progress.max = order.maxPatience;
        progress.setAttribute("aria-label", `${recipe.name} remaining patience`);
        card.append(title, art, progress); this.root.append(card);
      }
      if (!orders.length) {
        const waiting = document.createElement("span"); waiting.className = "orders-waiting";
        waiting.textContent = "The next guest is on their way…"; this.root.append(waiting);
      }
    }
    orders.forEach((order, index) => {
      const card = this.root.children[index] as HTMLElement;
      const progress = card?.querySelector("progress");
      if (progress) progress.value = Math.max(0, order.patience);
      card?.classList.toggle("urgent", order.patience / order.maxPatience < .3);
    });
  }
}
