import { requireAdmin, requireUser } from "@/lib/auth";
import { created, ok, parseBody, route } from "@/lib/http";
import prisma from "@/lib/prisma";
import { createCategorySchema } from "@/lib/validators/category.validation";
import { request } from "https";


// get all categories
export const GET = route(
    async(request) => {
        await requireUser(request);

        const categories = await prisma.resourceCategory.findMany({
            orderBy: {
                name: "asc",
            },
        });

        return ok(categories);

    }
)

// create a new category
export const POST = route(
    async(request)=>{
        await requireAdmin(request);
        const body =  await parseBody(request, createCategorySchema);
        const category = await prisma.resourceCategory.create({
            data: {
                name: body.name,
            },
        });

        return created(category);
    }
)