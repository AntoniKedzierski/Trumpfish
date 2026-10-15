using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Trumpfish.Server.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddInterjectionsJsonToBidNodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "InterjectionsJson",
                table: "BidNodes",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "InterjectionsJson",
                table: "BidNodes");
        }
    }
}
