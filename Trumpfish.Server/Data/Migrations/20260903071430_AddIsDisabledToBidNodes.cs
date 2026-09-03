using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddIsDisabledToBidNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsDisabled",
                table: "BidNodes",
                type: "boolean",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "IsDisabled",
                table: "BidNodes");
        }
    }
}
