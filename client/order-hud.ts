import { recipeById, orderDestinationLabel, isChoppedIngredient, ingredientLabel, type Order } from "../shared/game";
import { drawRecipeDrink, onDrinkArtReady } from "./drink-art";
import { drawIngredientIcon } from "./tavern-renderer";
import { drawChopBadge, onPreparationArtReady } from "./preparation-art";

export class OrderHud {
  private signature = "";
  constructor(private readonly root: HTMLElement, private readonly ingredients: HTMLImageElement, private readonly openRecipe?: (order:Order)=>void) {
    ingredients.addEventListener("load", () => { this.signature = ""; });
    onDrinkArtReady(() => { this.signature = ""; });
    onPreparationArtReady(() => { this.signature = ""; });
  }
  render(orders: Order[], solo = false) {
    const signature = JSON.stringify([solo,orders.map(order=>[order.id,order.recipeId,order.tableId,order.seatId,order.houseSpecial,order.maxPatience,order.customer])]);
    if (signature !== this.signature || !this.root.childElementCount) {
      this.signature = signature;
      this.root.replaceChildren();
      for (const order of orders) {
        const recipe = recipeById(order.recipeId);
        const card = document.createElement("article"); card.className = "order-ticket";
        if (this.openRecipe) {
          card.tabIndex=0;card.setAttribute("role","button");
          card.onclick=()=>this.openRecipe!(order);
          card.onkeydown=event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();this.openRecipe!(order);}};
        }
        card.setAttribute("aria-label",`${orderDestinationLabel(order)}, ${recipe.name}${order.houseSpecial?", House Special":""}. Open recipe instructions.`);
        if (order.houseSpecial) {
          card.classList.add("house-special");
          const flag = document.createElement("span"); flag.className = "special-flag"; flag.textContent = "✦";
          flag.setAttribute("aria-label", "House Special"); card.append(flag);
          card.setAttribute("aria-label", `${orderDestinationLabel(order)}, House Special ${recipe.name}. Bonus: ${solo ? "perfect preparation" : "two bartenders contribute"}, four coins.`);
        }
        const title = document.createElement("strong"); title.textContent = `${orderDestinationLabel(order)} · ${recipe.name}`;
        card.title = order.houseSpecial ? `${order.customer} · House Special · ${solo ? "Perfect preparation" : "Share gathering, chopping, mixing or serving"} for +4 coins and one warmth.` : order.customer;
        const art = document.createElement("canvas"); art.width = 216; art.height = 52;
        art.setAttribute("role", "img"); art.setAttribute("aria-label", `${recipe.name}: ${recipe.ingredients.map(ingredientLabel).join(", ")}${recipe.ingredients.some(isChoppedIngredient)?"; cleaver-marked ingredients must be prepared at the chopping board":""}`);
        const context = art.getContext("2d")!; context.imageSmoothingEnabled = false;
        drawRecipeDrink(context, recipe, 25, 25, 47);
        recipe.ingredients.forEach((ingredient, index) => {
          const x = 84 + index * 47;
          context.fillStyle = "#f1dfbf"; context.fillRect(x - 19, 5, 38, 39);
          drawIngredientIcon(context, this.ingredients, ingredient, x, 24, 31);
          if (isChoppedIngredient(ingredient)) drawChopBadge(context, x + 12, 39, 16);
        });
        const progress = document.createElement("progress"); progress.max = order.maxPatience;
        progress.setAttribute("aria-label", `${recipe.name} remaining patience`);
        const patience=document.createElement("span");patience.className="patience-label";
        card.append(title, art, progress, patience); this.root.append(card);
      }
      if (!orders.length) {
        const waiting = document.createElement("span"); waiting.className = "orders-waiting";
        waiting.textContent = "The next guest is on their way…"; this.root.append(waiting);
      }
    }
    orders.forEach((order, index) => {
      const card = this.root.children[index] as HTMLElement;
      const progress = card?.querySelector("progress");
      if (progress && progress.value!==Math.max(0,order.patience)) progress.value = Math.max(0, order.patience);
      const urgent=order.patience / order.maxPatience < .3;
      card?.classList.toggle("urgent", urgent);
      const label=card?.querySelector(".patience-label");
      if(label){
        const seconds=Math.ceil(Math.max(0,order.patience)),text=`${seconds}s${urgent?" !":""}`;
        if(label.textContent!==text){label.textContent=text;label.setAttribute("aria-label",`${seconds} seconds of patience${urgent?", serve soon":""}`);}
      }
    });
  }
}
