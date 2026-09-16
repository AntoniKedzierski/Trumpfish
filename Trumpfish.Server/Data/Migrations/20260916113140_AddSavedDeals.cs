using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSavedDeals : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SavedDeals",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uuid", nullable: false),
                    Name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Tags = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    Comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    Contract = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    Level = table.Column<int>(type: "integer", nullable: true),
                    Color = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Declarer = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    Dealer = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    Vulnerability = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    SavedUtc = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    Deal = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SavedDeals", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SavedDeals_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SavedDeals_OwnerId_Level_Color",
                table: "SavedDeals",
                columns: new[] { "OwnerId", "Level", "Color" });

            migrationBuilder.CreateIndex(
                name: "IX_SavedDeals_OwnerId_SavedUtc",
                table: "SavedDeals",
                columns: new[] { "OwnerId", "SavedUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SavedDeals");
        }
    }
}
