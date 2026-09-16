using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedDealShares : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SavedDealShares",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    DealId = table.Column<Guid>(type: "uuid", nullable: false),
                    ToUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    SharedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedDealShares", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedDealShares_SavedDeals_DealId",
                        column: x => x.DealId,
                        principalTable: "SavedDeals",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_SavedDealShares_Users_ToUserId",
                        column: x => x.ToUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedDealShares_DealId_ToUserId",
                table: "SavedDealShares",
                columns: new[] { "DealId", "ToUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SavedDealShares_ToUserId_SharedUtc",
                table: "SavedDealShares",
                columns: new[] { "ToUserId", "SharedUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SavedDealShares");
        }
    }
}
