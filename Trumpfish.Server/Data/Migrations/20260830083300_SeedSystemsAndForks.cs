using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class SeedSystemsAndForks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_BiddingSystems_OwnerId_Name",
                table: "BiddingSystems");

            migrationBuilder.AlterColumn<Guid>(
                name: "OwnerId",
                table: "BiddingSystems",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "ForkedFromId",
                table: "BiddingSystems",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ForkedFromVersionUtc",
                table: "BiddingSystems",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsSeed",
                table: "BiddingSystems",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // Seeds are now what an administrator curates, so everything an administrator owned becomes one and loses its owner.
            // The rename pass runs first because the unique index below treats null owners as equal, and two administrators
            // could in principle each have owned a system of the same name.
            migrationBuilder.Sql("""
                WITH ranked AS (
                    SELECT s."Id", row_number() OVER (PARTITION BY s."Name" ORDER BY s."CreatedUtc", s."Id") AS rn
                    FROM "BiddingSystems" s
                    JOIN "Users" u ON u."Id" = s."OwnerId"
                    WHERE u."IsAdmin"
                )
                UPDATE "BiddingSystems" b
                SET "Name" = b."Name" || ' (' || ranked.rn || ')'
                FROM ranked
                WHERE b."Id" = ranked."Id" AND ranked.rn > 1;
                """);

            migrationBuilder.Sql("""
                UPDATE "BiddingSystems"
                SET "IsSeed" = TRUE, "OwnerId" = NULL
                WHERE "OwnerId" IN (SELECT "Id" FROM "Users" WHERE "IsAdmin");
                """);

            migrationBuilder.CreateIndex(
                name: "IX_BiddingSystems_ForkedFromId",
                table: "BiddingSystems",
                column: "ForkedFromId");

            migrationBuilder.CreateIndex(
                name: "IX_BiddingSystems_IsSeed",
                table: "BiddingSystems",
                column: "IsSeed");

            migrationBuilder.CreateIndex(
                name: "IX_BiddingSystems_OwnerId_Name",
                table: "BiddingSystems",
                columns: new[] { "OwnerId", "Name" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.AddForeignKey(
                name: "FK_BiddingSystems_BiddingSystems_ForkedFromId",
                table: "BiddingSystems",
                column: "ForkedFromId",
                principalTable: "BiddingSystems",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // OwnerId becomes non-nullable again further down, so the ownerless seeds need an owner first: the oldest
            // administrator account, which is the one the forward migration took them from.
            migrationBuilder.Sql("""
                UPDATE "BiddingSystems"
                SET "OwnerId" = (SELECT "Id" FROM "Users" WHERE "IsAdmin" ORDER BY "CreatedUtc", "Id" LIMIT 1)
                WHERE "OwnerId" IS NULL;
                """);

            migrationBuilder.Sql("""DELETE FROM "BiddingSystems" WHERE "OwnerId" IS NULL;""");

            migrationBuilder.DropForeignKey(
                name: "FK_BiddingSystems_BiddingSystems_ForkedFromId",
                table: "BiddingSystems");

            migrationBuilder.DropIndex(
                name: "IX_BiddingSystems_ForkedFromId",
                table: "BiddingSystems");

            migrationBuilder.DropIndex(
                name: "IX_BiddingSystems_IsSeed",
                table: "BiddingSystems");

            migrationBuilder.DropIndex(
                name: "IX_BiddingSystems_OwnerId_Name",
                table: "BiddingSystems");

            migrationBuilder.DropColumn(
                name: "ForkedFromId",
                table: "BiddingSystems");

            migrationBuilder.DropColumn(
                name: "ForkedFromVersionUtc",
                table: "BiddingSystems");

            migrationBuilder.DropColumn(
                name: "IsSeed",
                table: "BiddingSystems");

            migrationBuilder.AlterColumn<Guid>(
                name: "OwnerId",
                table: "BiddingSystems",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_BiddingSystems_OwnerId_Name",
                table: "BiddingSystems",
                columns: new[] { "OwnerId", "Name" },
                unique: true);
        }
    }
}
